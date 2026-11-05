using StorageProject.Core.Entities;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

public sealed class DepositPolicyD32Tests
{
    [Fact]
    public void CalculateDeposit_WhenPolicyIsNull_ReturnsOneMonthRent()
    {
        var deposit = OpsRules.CalculateDeposit(null, 1_500_000m, 4_500_000m);
        Assert.Equal(1_500_000m, deposit);
    }

    [Fact]
    public void CalculateDeposit_WhenPolicyIsFixedOne_ReturnsOneMonthRent()
    {
        var policy = new Policy
        {
            PolicyType = "DEPOSIT",
            CalculationType = "FIXED",
            Value = 1m
        };
        var deposit = OpsRules.CalculateDeposit(policy, 1_500_000m, 4_500_000m);
        Assert.Equal(1_500_000m, deposit);
    }

    [Fact]
    public void CalculateDeposit_WhenPolicyIsFixedCustomAmount_ReturnsCustomAmount()
    {
        var policy = new Policy
        {
            PolicyType = "DEPOSIT",
            CalculationType = "FIXED",
            Value = 2_000_000m
        };
        var deposit = OpsRules.CalculateDeposit(policy, 1_500_000m, 4_500_000m);
        Assert.Equal(2_000_000m, deposit);
    }

    [Fact]
    public void CalculateDeposit_WhenPolicyIsLegacyPercentage_CalculatesPercentage()
    {
        var policy = new Policy
        {
            PolicyType = "DEPOSIT",
            CalculationType = "PERCENTAGE",
            Value = 100m // 100% of estimatedAmount
        };
        var deposit = OpsRules.CalculateDeposit(policy, 1_500_000m, 4_500_000m);
        Assert.Equal(4_500_000m, deposit);
    }
}

