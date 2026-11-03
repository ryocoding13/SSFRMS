using System.Collections.Concurrent;
using StorageProject.Core.Interfaces;

namespace StorageProject.Infrastructure.Services;

public class DefaultScanRateLimiter : IScanRateLimiter
{
    public static readonly DefaultScanRateLimiter Instance = new();

    private readonly ConcurrentDictionary<string, ConcurrentQueue<DateTime>> _attempts = new();
    private readonly int _permitLimit;
    private readonly TimeSpan _window;

    public DefaultScanRateLimiter(int permitLimit = 10, TimeSpan? window = null)
    {
        _permitLimit = permitLimit;
        _window = window ?? TimeSpan.FromMinutes(1);
    }

    public bool TryAcquire(string clientIp, DateTime? now = null)
    {
        var key = string.IsNullOrWhiteSpace(clientIp) ? "unknown" : clientIp.Trim();
        var currentTime = now ?? DateTime.UtcNow;
        var cutoff = currentTime - _window;

        var queue = _attempts.GetOrAdd(key, _ => new ConcurrentQueue<DateTime>());

        lock (queue)
        {
            while (queue.TryPeek(out var timestamp) && timestamp <= cutoff)
            {
                queue.TryDequeue(out _);
            }

            if (queue.Count >= _permitLimit)
            {
                return false;
            }

            queue.Enqueue(currentTime);
            return true;
        }
    }

    public void Reset()
    {
        _attempts.Clear();
    }
}
