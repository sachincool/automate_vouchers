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

test("waitForOtp never re-accepts an OTP already consumed (multi-purchase runs)", async () => {
  const axios = require("axios");
  const { waitForOtp } = require("./shopwise_automate");
  const state = (payment_otp) => ({
    data: {
      success: true,
      payment_otp,
      timestamp: new Date().toISOString(),
      expires_at: new Date(Date.now() + 40000).toISOString(),
    },
  });
  const orig = axios.post;
  let calls = 0;
  axios.post = async () => state(++calls < 3 ? "111111" : "222222");
  try {
    assert.equal(await waitForOtp("payment_otp", { timeoutMs: 20000 }), "111111");
    // The n8n store still holds 111111 (and a bumped expires_at) — purchase 2 must wait for 222222.
    assert.equal(await waitForOtp("payment_otp", { timeoutMs: 20000 }), "222222");
  } finally {
    axios.post = orig;
  }
});
