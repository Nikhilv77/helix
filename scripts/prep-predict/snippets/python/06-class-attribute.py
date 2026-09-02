class Counter:
    total = 0

    def bump(self):
        self.total += 1


a = Counter()
b = Counter()
a.bump()
print(a.total, b.total, Counter.total)

Counter.total = 10
print(a.total, b.total, Counter.total)
