import os
import requests
from typing import Dict
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def prompt_for_voucher_details() -> Dict[str, str]:
    """Prompt the user for voucher code and secret (pin)."""
    code = input("Enter the voucher code: ").strip()
    secret = input("Enter the voucher pin/secret: ").strip()
    if not code or not secret:
        raise ValueError("Both voucher code and pin/secret are required.")
    return {'code': code, 'secret': secret}


# Default header values - use environment variables for sensitive data
DEFAULT_HEADERS = {
    'deviceId': os.getenv('SWIGGY_DEVICE_ID', 'your-device-id'),
    'tid': os.getenv('SWIGGY_TID', 'your-transaction-id'),
    'token': os.getenv('SWIGGY_TOKEN', 'your-auth-token'),

    # 'deviceId': 'facf3a95d7e2b4b1',
    # 'tid': 'd4cae315-c6bf-40b0-905f-352aaf04cf80',
    # 'token': '69e4d984-9765-47af-bdd3-0dce79972fdce776a1d0-c09d-4ee1-925d-72a33c2e9b6d',
}

# Documented behavior: If an environment variable matching a header name exists, it overrides the default.


def build_headers() -> Dict[str, str]:
    """Build headers using environment variables or defaults."""
    # Simply return the DEFAULT_HEADERS since they already use os.getenv()
    return DEFAULT_HEADERS.copy()


def debug_environment_variables():
    """Debug function to check if environment variables are being read correctly."""
    print("=== Environment Variable Debug ===")
    print(f"SWIGGY_DEVICE_ID: {os.getenv('SWIGGY_DEVICE_ID', 'NOT SET')}")
    print(f"SWIGGY_TID: {os.getenv('SWIGGY_TID', 'NOT SET')}")
    print(f"SWIGGY_TOKEN: {os.getenv('SWIGGY_TOKEN', 'NOT SET')}")
    print("=== Headers that will be used ===")
    headers = build_headers()
    for key, value in headers.items():
        # Mask the token for security
        display_value = value if key != 'token' else f"{value[:8]}..." if len(
            value) > 8 else "***"
        print(f"{key}: {display_value}")
    print("================================")


# Endpoint URL (can be overridden by env var)
SWIGGY_URL = os.getenv('SWIGGY_VOUCHER_CLAIM_URL',
                       'https://chkout.swiggy.com/swiggymoney/voucher/claim')


def claim_voucher():
    """Sends the PATCH request to claim the Swiggy voucher."""
    headers = build_headers()
    payload = prompt_for_voucher_details()
    try:
        response = requests.patch(
            SWIGGY_URL, headers=headers, json=payload, timeout=10)
        # Always try to parse the response JSON
        try:
            resp_json = response.json()
        except ValueError:
            print(f"Received non-JSON response: {response.text}")
            response.raise_for_status()
            return

        status_code = resp_json.get('statusCode')
        status_message = resp_json.get(
            'statusMessage', 'No status message provided.')
        data = resp_json.get('data')

        if status_code == 0:
            value = data.get('value') if data else None
            print(
                f"\033[92mVoucher claim successful! Amount credited: ₹{value if value is not None else 'Unknown'}\033[0m")
        elif status_code == 7:
            print(f"\033[93mVoucher already claimed: {status_message}\033[0m")
        else:
            print(
                f"\033[91mVoucher claim failed: {status_message} (statusCode: {status_code})\033[0m")
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"Voucher claim failed due to a network or HTTP error: {e}")
        if e.response is not None:
            print(f"Response: {e.response.text}")


if __name__ == '__main__':
    debug_environment_variables()
    claim_voucher()
