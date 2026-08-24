import os
import uuid
import requests

BASE = os.environ.get("NEXT_PUBLIC_BASE_URL", "https://mountain-harmony.preview.emergentagent.com").rstrip("/") + "/api"


def get(path):
    response = requests.get(BASE + path, timeout=30)
    print("GET", path, response.status_code)
    return response


def post(path, payload):
    response = requests.post(BASE + path, json=payload, timeout=30)
    print("POST", path, response.status_code)
    return response


def check(condition, message):
    if not condition:
        raise AssertionError(message)
    print("PASS:", message)


def main():
    overview_before = get("")
    check(overview_before.ok, "overview endpoint responds successfully")
    packages = get("/packages")
    check(packages.ok and packages.json().get("packages"), "packages endpoint returns an existing package")
    hosts = get("/hosts")
    check(hosts.ok and hosts.json().get("hosts"), "hosts endpoint returns hosts")
    categories_before = get("/categories")
    check(categories_before.ok, "categories endpoint responds successfully")

    package = packages.json()["packages"][0]
    host_id = package["host_id"]
    host_before = next(h for h in hosts.json()["hosts"] if h["id"] == host_id)
    dynamic_name = "Akses Belajar " + uuid.uuid4().hex[:10]
    category_response = post("/categories", {"name": dynamic_name, "allocation_percent": 1, "icon": "book"})
    check(category_response.status_code == 201, "dynamic category creation returns 201")
    categories_after = get("/categories")
    check(any(c.get("name") == dynamic_name for c in categories_after.json().get("categories", [])), "created category is returned by GET categories")

    overview_before_booking = get("").json()
    booking_response = post("/bookings", {"package_id": package["id"], "guest_name": "Rina Prameswari", "guest_count": 2, "travel_date": "2026-08-15"})
    check(booking_response.status_code == 201, "booking creation returns 201")
    booking_data = booking_response.json()
    booking = booking_data["booking"]
    allocations = booking_data["allocations"]
    check(booking["status"] == "confirmed", "booking status is confirmed")
    expected_total = package["price"] * 2
    check(booking["total_amount"] == expected_total, "booking total equals package price multiplied by guest_count")
    active_defaults = [c for c in categories_after.json()["categories"] if c.get("active", True) and c.get("is_default", False)]
    check(len(allocations) == len(active_defaults), "one allocation is created per active default category")
    by_name = {c["name"]: c for c in active_defaults}
    for allocation in allocations:
        category = by_name[allocation["allocation_category"]]
        expected_amount = round(expected_total * category["allocation_percent"] / 100)
        check(allocation["amount"] == expected_amount, "allocation amount matches total_amount * percent / 100")
    hosts_after = get("/hosts").json()["hosts"]
    host_after = next(h for h in hosts_after if h["id"] == host_id)
    check(host_after["impact_total"] == host_before["impact_total"] + sum(a["amount"] for a in allocations), "host impact_total increases by allocation sum")

    overview_after = get("")
    check(overview_after.ok, "overview endpoint responds after booking")
    totals = {row["category"]: row["total"] for row in overview_after.json()["totals"]}
    for allocation in allocations:
        before = next((r["total"] for r in overview_before_booking.get("totals", []) if r["category"] == allocation["allocation_category"]), 0)
        check(totals.get(allocation["allocation_category"]) == before + allocation["amount"], "overview includes new per-category allocation total")

    malformed = post("/bookings", {"package_id": "not-a-real-package-id", "guest_name": "Rina Prameswari", "guest_count": 2})
    check(malformed.status_code == 404 and "error" in malformed.json(), "malformed package_id returns clear 404")
    missing_name = post("/categories", {"allocation_percent": 1})
    check(missing_name.status_code == 400, "missing category name returns 400")
    print("ALL BACKEND TESTS PASSED")


if __name__ == "__main__":
    main()
