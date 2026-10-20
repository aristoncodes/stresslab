# Brute force: try every subarray, O(n^2).
n = int(input())
a = list(map(int, input().split()))
best = a[0]
for i in range(n):
    s = 0
    for j in range(i, n):
        s += a[j]
        best = max(best, s)
print(best)
