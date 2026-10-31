"use client";

import { Download, FileText, Printer } from "lucide-react";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";

export function ReportActions({ query }: { query: string }) {
  const href = (type: string) => `/api/reports/export?type=${type}${query ? `&${query}` : ""}`;
  return (
    <>
      <Dropdown
        trigger={({ toggle }) => (
          <Button variant="secondary" onClick={toggle}>
            <Download /> Export CSV
          </Button>
        )}
      >
        {(close) => (
          <>
            <DropdownItem icon={FileText} href={href("leads")} onClick={close}>
              Leads in range
            </DropdownItem>
            <DropdownItem icon={FileText} href={href("sources")} onClick={close}>
              Source performance
            </DropdownItem>
            <DropdownItem icon={FileText} href={href("agents")} onClick={close}>
              Agent leaderboard
            </DropdownItem>
            <DropdownItem icon={FileText} href={href("deals")} onClick={close}>
              Closed deals
            </DropdownItem>
          </>
        )}
      </Dropdown>
      <Button variant="secondary" onClick={() => window.print()}>
        <Printer /> Download PDF
      </Button>
    </>
  );
}
