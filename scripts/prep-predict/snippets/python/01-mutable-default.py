def add(item, bucket=[]):
    bucket.append(item)
    return bucket

print(add(1))
print(add(2))
print(add(3, []))
print(add(4))
