import React from "react";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";

export const useMe = () => {
  const { user } = useApp();
  const { ops } = useOps();
  return ops.me || ops.staff.find((s) => s.full_name === user?.full_name) || ops.staff[0] || { staff_id: null, full_name: user?.full_name };
};
