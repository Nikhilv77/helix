people = [("ann", 2), ("bob", 1), ("cat", 2), ("dan", 1)]
print(sorted(people, key=lambda p: p[1]))
print(sorted(people, key=lambda p: p[1], reverse=True))
