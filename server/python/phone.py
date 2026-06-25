"""Phone parsing/validation worker using libphonenumber (phonenumbers).

Input  : {"phones": [{"value":"416-555-0142","region":"CA"}], "default_region":"US"}
Output : {"results": [{input,e164,national,valid,possible,type,region,country_code}]}
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shared.io import run  # noqa: E402

import phonenumbers  # noqa: E402
from phonenumbers import PhoneNumberType, geocoder  # noqa: E402

TYPE_NAMES = {
    PhoneNumberType.MOBILE: "mobile",
    PhoneNumberType.FIXED_LINE: "landline",
    PhoneNumberType.FIXED_LINE_OR_MOBILE: "fixed_or_mobile",
    PhoneNumberType.VOIP: "voip",
    PhoneNumberType.TOLL_FREE: "toll_free",
    PhoneNumberType.PREMIUM_RATE: "premium",
}


def parse_one(value, region):
    out = {
        "input": value, "e164": None, "national": None, "valid": False,
        "possible": False, "type": "unknown", "region": region, "country_code": None,
    }
    try:
        num = phonenumbers.parse(value, region)
        out["possible"] = phonenumbers.is_possible_number(num)
        out["valid"] = phonenumbers.is_valid_number(num)
        out["country_code"] = num.country_code
        out["type"] = TYPE_NAMES.get(phonenumbers.number_type(num), "unknown")
        if out["valid"]:
            out["e164"] = phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)
            out["national"] = phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.NATIONAL)
            out["region"] = geocoder.region_code_for_number(num) or region
    except phonenumbers.NumberParseException as e:
        out["error"] = str(e)
    return out


def handler(data):
    default_region = data.get("default_region", "US")
    items = data.get("phones") or []
    results = []
    for it in items:
        if isinstance(it, str):
            results.append(parse_one(it, default_region))
        else:
            results.append(parse_one(it.get("value"), it.get("region") or default_region))
    return {"results": results}


if __name__ == "__main__":
    run(handler)
