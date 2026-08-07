import { Image, Pressable, View } from "react-native";

import { CLASS_BY_VALUE } from "../../lib/asset-classes";
import { formatDateRange, todayIso } from "../../lib/hire-domain";
import { resolveMediaUrl } from "../../lib/media";
import type { Hire } from "../../lib/types";
import { useCountdown } from "../../lib/use-countdown";
import { BodyText, Money, MonoText } from "../ui/text";
import { StatusBadge } from "./status-badge";

/** The one context chip a card earns — the next thing the hirer must do. */
function ContextChip({ hire }: { hire: Hire }) {
  const pay = useCountdown(hire.status === "accepted" ? hire.payment_deadline : null);
  const today = todayIso();

  if (hire.status === "accepted" && pay && !pay.expired) {
    return (
      <View className="self-start rounded-full bg-amber-100 px-2.5 py-0.5">
        <BodyText className="text-caption font-sans-semibold text-amber-900">
          Pay within {pay.label}
        </BodyText>
      </View>
    );
  }
  if (hire.status === "confirmed" && hire.start_date === today) {
    return (
      <View className="self-start rounded-full bg-amber-100 px-2.5 py-0.5">
        <BodyText className="text-caption font-sans-semibold text-amber-900">Handover today</BodyText>
      </View>
    );
  }
  if (hire.status === "on_hire" && hire.end_date === today) {
    return (
      <View className="self-start rounded-full bg-amber-100 px-2.5 py-0.5">
        <BodyText className="text-caption font-sans-semibold text-amber-900">Off-hire today</BodyText>
      </View>
    );
  }
  return null;
}

export function HireCard({ hire, onPress }: { hire: Hire; onPress: () => void }) {
  const cls = CLASS_BY_VALUE[hire.asset_class];
  const photo = hire.listing_photo ? resolveMediaUrl(hire.listing_photo) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Hire: ${hire.listing_title}`}
      onPress={onPress}
      className="flex-row gap-3 border-b border-border-default bg-surface-card px-4 py-3 active:bg-surface-sunken"
    >
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: 72, height: 72, borderRadius: 8 }} />
      ) : (
        <View className={`h-[72px] w-[72px] items-center justify-center rounded-lg ${cls.bg}`}>
          <View className={`h-2.5 w-2.5 rounded-full ${cls.dot}`} />
        </View>
      )}
      <View className="flex-1 gap-1">
        <View className="flex-row items-start justify-between gap-2">
          <BodyText className="flex-1 font-sans-semibold" numberOfLines={1}>
            {hire.listing_title}
          </BodyText>
          <StatusBadge status={hire.status} />
        </View>
        <MonoText className="text-body-sm text-text-secondary">
          {formatDateRange(hire.start_date, hire.end_date, hire.duration_days)}
        </MonoText>
        <View className="flex-row items-center justify-between gap-2">
          <ContextChip hire={hire} />
          <Money display={hire.hire_value_display} className="ml-auto" />
        </View>
      </View>
    </Pressable>
  );
}
