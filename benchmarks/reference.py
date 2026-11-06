# Independent continuity benchmark with synthetic patients.
# No external dependencies or patient data. Run: python3 benchmarks/reference.py
from collections import Counter, defaultdict
from fractions import Fraction
from json import dumps

events = []
def add(patient, usual, clinician, count):
    events.extend((patient, usual, clinician) for _ in range(count))

add("SYN-A", "Dr Ash", "Dr Birch", 4)
add("SYN-A", "Dr Ash", "Dr Ash", 1)
add("SYN-B", "Dr Birch", "Dr Ash", 5)
add("SYN-B", "Dr Birch", "Dr Birch", 1)
add("SYN-C", "Dr Ash", "Dr Ash", 4)
add("SYN-D", "Dr Birch", "Dr Ash", 2)
add("SYN-D", "Dr Birch", "Dr Birch", 2)

patients = defaultdict(list)
owners = {}
for patient, usual, clinician in events:
    patients[patient].append(clinician)
    owners[patient] = usual

upc = []
own_visits = 0
eligible = []
aligned = 0
clear_mismatch = 0
for patient, clinicians in patients.items():
    counts = Counter(clinicians)
    owner = owners[patient]
    most_seen = max(counts.values())
    winners = [doctor for doctor, count in counts.items() if count == most_seen]
    upc.append(Fraction(most_seen, len(clinicians)))
    own_visits += counts[owner]
    if len(winners) == 1 and winners[0] == owner:
        aligned += 1
    elif len(winners) == 1 and Fraction(most_seen, len(clinicians)) >= Fraction(1, 2):
        eligible.append((patient, owner, winners[0]))
        clear_mismatch += 1

expected = {
    "patientCount": len(patients),
    "totalVisits": len(events),
    "ownVisits": own_visits,
    "slicc": float(Fraction(own_visits, len(events))),
    "meanUPC": float(sum(upc, Fraction(0, 1)) / len(upc)),
    "usualAccuracy": float(Fraction(aligned, aligned + clear_mismatch)),
    "potentialReallocations": len(eligible),
    "reciprocalPairs": int(any(a[1] == b[2] and a[2] == b[1] for a in eligible for b in eligible if a != b))
}
assert expected == {
    "patientCount": 4,
    "totalVisits": 19,
    "ownVisits": 8,
    "slicc": 8 / 19,
    "meanUPC": (4/5 + 5/6 + 1 + 1/2) / 4,
    "usualAccuracy": 1 / 3,
    "potentialReallocations": 2,
    "reciprocalPairs": 1
}
print(dumps(expected, indent=2, sort_keys=True))
