const test = require("node:test");
const assert = require("node:assert/strict");
const { waitForConfirmation } = require("./shopwise_automate");

test("advances the post-3DS processing interstitial", async () => {
  let url = "https://shopwise.giftstacc.com/card";
  let clicked = false;
  const link = {
    isVisible: async () => true,
    click: async () => {
      clicked = true;
      url = "https://shopwise.giftstacc.com/order-confirmation";
    },
  };
  const page = {
    url: () => url,
    frames: () => [],
    getByText: () => ({ first: () => link }),
  };

  const result = await waitForConfirmation({ pages: () => [page] }, 5000);

  assert.equal(clicked, true);
  assert.equal(result, page);
});
