import React from "react";
import { UNIT_STATE } from "../data/facilityOperationsSeed.js";

export const unitStateTag = (s) => UNIT_STATE[s] || [s, "gray"];
