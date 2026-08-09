"""Free-text (`q`) matching for the search endpoints (FSD §6, TSD §3.7).

`q` used to be a single **contiguous substring** test against
``title + description``. That is not a search — it is a `str.__contains__`, and
it failed on almost every real query a hirer types:

===========================  ==========================================
query                        result against the demo catalogue
===========================  ==========================================
``30t excavator``            0 hits (the app's own placeholder text)
``cat excavator``            0 hits
``30 tonne tipper``          0 hits ("Howo 30-**tonne** Tipper")
``cold store``               0 hits ("Frozen Store", "Chilled Store")
``excavators``               1 hit — and it was a *lowbed trailer*
===========================  ==========================================

This module replaces that with the smallest thing that is actually a search:

1. **Normalise** both sides — case-fold, strip accents, drop the thousands
   separator, and collapse ``number + unit`` into one canonical token so
   ``30-tonne``, ``30 tonnes`` and ``30t`` are the same thing.
2. **Tokenise** the query and require **every** token to match (AND). Order is
   irrelevant, so ``tipper 30t`` and ``30t tipper`` behave the same.
3. Match a token against a **word prefix** of the document, so as-you-type
   ``exca`` works and ``cat`` finds ``Caterpillar``; a light de-pluralising
   stem makes ``excavators`` find ``excavator``.
4. Search a **document**, not one column: title, asset type, the string spec
   values (make/model/fuel/condition…), description, yard name + city and the
   supplier's business name.

Deliberately **not** here: relevance ranking. ``/search/list`` is keyset-paginated
on ``(distance_km, id)`` (``search.pagination``) — a relevance sort changes that
frozen ordering contract and belongs with the Postgres ``tsvector`` work, not
with a predicate fix. Everything below stays a pure boolean predicate, so the
result *set* gets correct while the result *order* is untouched.
"""

from __future__ import annotations

import re
import unicodedata
from functools import lru_cache

# ``number + unit`` → one canonical token, applied to the query and the document
# alike. Order matters: the longer unit names must be tried before the
# single-letter ones they contain.
_UNIT_ALIASES: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(pattern), repl)
    for pattern, repl in (
        (r"(\d+(?:\.\d+)?)\s*-?\s*teu\b", r"\1teu"),
        (r"(\d+(?:\.\d+)?)\s*-?\s*(?:sqm|sq\.?\s?m|m2|square\s+met(?:re|er)s?)\b", r"\1sqm"),
        (r"(\d+(?:\.\d+)?)\s*-?\s*(?:tonnes|tonne|tons|ton|t)\b", r"\1t"),
        (r"(\d+(?:\.\d+)?)\s*-?\s*(?:litres|liters|litre|liter)\b", r"\1l"),
        (r"(\d+(?:\.\d+)?)\s*-?\s*kva\b", r"\1kva"),
        (r"(\d+(?:\.\d+)?)\s*-?\s*(?:metres|meters|metre|meter|m)\b", r"\1m"),
    )
)

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_THOUSANDS = re.compile(r"(?<=\d),(?=\d)")

# Spec keys whose values are free text a hirer would never search on.
_SPEC_NOISE = frozenset({"notes", "comment", "comments"})


def normalize(text: str) -> str:
    """Case-fold, de-accent, de-punctuate and canonicalise units.

    ``"Howo 30-tonne Tipper — sand, granite"`` → ``"howo 30t tipper sand granite"``.
    """
    decomposed = unicodedata.normalize("NFKD", text)
    folded = "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower()
    folded = _THOUSANDS.sub("", folded)  # 33,000 → 33000
    for pattern, repl in _UNIT_ALIASES:
        folded = pattern.sub(repl, folded)
    return _NON_ALNUM.sub(" ", folded).strip()


@lru_cache(maxsize=1024)
def query_tokens(q: str) -> tuple[str, ...]:
    """The AND-ed terms of a user query. Cached — one query, many listings."""
    return tuple(normalize(q).split())


@lru_cache(maxsize=4096)
def _variants(token: str) -> tuple[str, ...]:
    """The token plus a light de-pluralised stem (``excavators`` → ``excavator``)."""
    forms = [token]
    if len(token) > 4 and token.endswith("es") and not token.endswith("ses"):
        forms.append(token[:-2])
    if len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
        forms.append(token[:-1])
    return tuple(forms)


def _spec_words(specs: object) -> list[str]:
    """The searchable string spec values ("Caterpillar", "320D", "Tracked")."""
    if not isinstance(specs, dict):
        return []
    return [
        value
        for key, value in specs.items()
        if isinstance(value, str) and str(key).lower() not in _SPEC_NOISE
    ]


def document(listing) -> frozenset[str]:
    """The normalised word set searched for one listing, cached on the instance.

    Callers must have ``select_related`` d ``yard`` and
    ``supplier__supplier_profile`` (``common.base_listings`` does) — this never
    issues a query of its own beyond what is already loaded.
    """
    cached = getattr(listing, "_search_document", None)
    if cached is not None:
        return cached

    parts: list[str] = [listing.title, listing.asset_type, listing.description]
    parts.extend(_spec_words(listing.specs))

    yard = listing.yard
    if yard is not None:
        parts.extend((yard.name, yard.city))
    parts.append(listing.address_text)
    parts.append(listing.city)

    profile = getattr(listing.supplier, "supplier_profile", None)
    if profile is not None:
        parts.append(profile.business_name)

    words = frozenset(normalize(" ".join(p for p in parts if p)).split())
    listing._search_document = words
    return words


def _token_matches(token: str, words: frozenset[str]) -> bool:
    for variant in _variants(token):
        if variant in words:  # cheap exact hit first
            return True
        if any(word.startswith(variant) for word in words):
            return True
    return False


def matches_query(listing, q: str) -> bool:
    """True iff **every** token in ``q`` prefix-matches a word in the document."""
    tokens = query_tokens(q)
    if not tokens:
        return True
    words = document(listing)
    return all(_token_matches(token, words) for token in tokens)
