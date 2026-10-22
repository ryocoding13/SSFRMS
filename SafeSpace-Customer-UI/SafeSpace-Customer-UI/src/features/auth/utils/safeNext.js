import React from "react";

export const safeNext = (next) => (next && !/^(login|register)/.test(next) ? next : "overview");
