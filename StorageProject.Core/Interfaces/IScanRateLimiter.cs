namespace StorageProject.Core.Interfaces;

public interface IScanRateLimiter
{
    bool TryAcquire(string clientIp, DateTime? now = null);
    void Reset();
}
