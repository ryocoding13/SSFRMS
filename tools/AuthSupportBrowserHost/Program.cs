using StorageProject.Tests;
await using var fixture = await AuthSupportHttpFixture.Create();
Console.WriteLine($"AUTH_SUPPORT_TEST_API={fixture.Address}");
var stopped = new TaskCompletionSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; stopped.TrySetResult(); };
await stopped.Task;
