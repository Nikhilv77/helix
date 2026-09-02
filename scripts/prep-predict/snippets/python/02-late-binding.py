callbacks = []
for i in range(3):
    callbacks.append(lambda: i)

print([c() for c in callbacks])

fixed = [lambda i=i: i for i in range(3)]
print([c() for c in fixed])
