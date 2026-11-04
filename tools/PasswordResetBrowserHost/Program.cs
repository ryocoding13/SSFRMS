if (args.Contains("--inquiries"))
{
    await using var inquiries = await StorageProject.Tests.AuthSupportHttpFixture.Create(withInquiries: true);
    Console.WriteLine($"INQUIRY_TEST_API={inquiries.Address}");
    while (await Console.In.ReadLineAsync() is string command) if (command == "stop") break;
    return;
}
await using var fixture = await StorageProject.Tests.PasswordResetFixture.Create();
Console.WriteLine($"PASSWORD_RESET_TEST_API={fixture.Address}");
// Giao tiếp OTP chỉ qua stdin/stdout của tiến trình test, không có HTTP endpoint đọc mã.
while (await Console.In.ReadLineAsync() is string command)
{
    if (command == "code") Console.WriteLine("TEST_CODE=" + fixture.Mailbox.Messages.LastOrDefault().Code);
    else if (command == "advance") fixture.Clock.Advance(TimeSpan.FromMinutes(11));
    else if (command == "mail-fail") fixture.Mailbox.Fail = true;
    else if (command == "stop") break;
}
