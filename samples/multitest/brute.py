# Brute force per test case: try every subarray.
t = int(input())
for _ in range(t):
    n = int(input())
    a = list(map(int, input().split()))
    print(max(sum(a[i:j + 1]) for i in range(n) for j in range(i, n)))
