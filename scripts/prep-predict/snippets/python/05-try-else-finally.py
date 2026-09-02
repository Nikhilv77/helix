def run(values):
    steps = []
    try:
        steps.append("try")
        values[10]
    except IndexError:
        steps.append("except")
    else:
        steps.append("else")
    finally:
        steps.append("finally")
    return steps

print(run([1, 2, 3]))
print(run(list(range(20))))
