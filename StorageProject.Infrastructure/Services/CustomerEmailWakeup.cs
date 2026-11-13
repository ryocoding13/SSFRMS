using System.Threading.Channels;

namespace StorageProject.Infrastructure.Services;

/// <summary>Signals committed mail events to the local worker. The database remains the durable queue.</summary>
public sealed class CustomerEmailWakeup
{
    private readonly Channel<bool> signal = Channel.CreateBounded<bool>(1);

    public void Notify() => signal.Writer.TryWrite(true);

    public async Task WaitAsync(TimeSpan interval, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(interval);
        try { await signal.Reader.ReadAsync(timeout.Token); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { }
    }
}
