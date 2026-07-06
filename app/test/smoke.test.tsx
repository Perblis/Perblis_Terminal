import { render } from "@testing-library/react-native";

import Index from "../app/index";

test("smoke: index screen renders", async () => {
  const { getByText } = await render(<Index />);
  expect(getByText("Terminal")).toBeTruthy();
});
