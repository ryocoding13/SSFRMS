using StorageProject.Core.DTOs.Ops;

namespace StorageProject.Core.Interfaces;

public interface IManagerService
{
    Task<OpsBoardDto> GetManagerBoardAsync(long userId, CancellationToken ct = default);
    Task AllocateUnitAsync(long userId, string id, AllocateUnitRequest request, CancellationToken ct = default);
    Task AssignStaffAsync(long userId, string id, AssignStaffRequest request, CancellationToken ct = default);
    Task ApproveRenewalAsync(long userId, string id, CancellationToken ct = default);
    Task RejectRenewalAsync(long userId, string id, RejectRenewalRequest request, CancellationToken ct = default);
    Task AddContractReminderAsync(long userId, string id, AddReminderRequest request, CancellationToken ct = default);

    // Facility storage unit management (UC13)
    Task<IReadOnlyList<OpsUnitDto>> GetFacilityUnitsAsync(long userId, CancellationToken ct = default);
    Task<OpsUnitDto> CreateUnitAsync(long userId, CreateStorageUnitRequest request, CancellationToken ct = default);
    Task<OpsUnitDto> UpdateUnitAsync(long userId, string id, UpdateStorageUnitRequest request, CancellationToken ct = default);
    Task LockUnitAsync(long userId, string id, LockUnitRequest request, CancellationToken ct = default);
}
