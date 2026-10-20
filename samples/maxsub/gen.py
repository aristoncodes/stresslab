# Custom generator: argv[1] = seed, argv[2] = test number. Small arrays first.
import random, sys
seed, test = int(sys.argv[1]), int(sys.argv[2])
random.seed(seed)
n = random.randint(1, min(8, 1 + test // 10))
print(n)
print(*[random.randint(-10, 10) for _ in range(n)])
