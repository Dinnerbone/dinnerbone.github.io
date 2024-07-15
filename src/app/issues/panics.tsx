"use client";

import { IssuesByPanic, PanicInfo } from "@/app/issues/data";
import {
  Badge,
  Card,
  CardSection,
  Checkbox,
  Code,
  Group,
  List,
  ListItem,
  Select,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  Title,
} from "@mantine/core";
import classes from "@/app/issues/issues.module.css";
import Link from "next/link";
import React, { useState } from "react";

const OLD_BUILD_CUTOFF_MS = 180 * 24 * 60 * 60 * 1000;

function Panic({ panic, info }: { panic: string; info: PanicInfo }) {
  const title = panic.replace(/\n[^]+$/, "");
  const oldBuildOnly = !panicAffectsNewBuild(info);
  return (
    <Card shadow="sm" radius="md" className={classes.panicCard}>
      <CardSection inheritPadding py="xs">
        <Group gap="xs" wrap="nowrap">
          <Title fw={500} flex="1" order={3}>
            {title}
          </Title>
          {info.numOpenIssues < info.numIssues && (
            <Badge color="red">{info.numIssues - info.numOpenIssues}</Badge>
          )}
          {info.numOpenIssues > 0 && (
            <Badge color="green">{info.numOpenIssues}</Badge>
          )}
        </Group>
      </CardSection>
      <CardSection inheritPadding py="xs">
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTab value="details">Details</TabsTab>
            <TabsTab value="errorMessage">Error Message</TabsTab>
            <TabsTab value="issues">Issues</TabsTab>
          </TabsList>
          <TabsPanel value="details">
            <List>
              <ListItem>
                Reported between{" "}
                <b>{info.firstReported.toISOString().split("T")[0]}</b> and{" "}
                <b>{info.lastReported.toISOString().split("T")[0]}</b>
              </ListItem>
              {info.firstBuild && info.lastBuild && (
                <ListItem>
                  Affects builds between{" "}
                  <b>{info.firstBuild.toISOString().split("T")[0]}</b> and{" "}
                  <b>{info.lastBuild.toISOString().split("T")[0]}</b>{" "}
                  {oldBuildOnly && <Badge color="red">Only Old Builds</Badge>}
                </ListItem>
              )}
            </List>
          </TabsPanel>
          <TabsPanel value="errorMessage">
            <Code block>{panic}</Code>
          </TabsPanel>
          <TabsPanel value="issues">
            <Table>
              <TableThead>
                <TableTr>
                  <TableTh>#</TableTh>
                  <TableTh>Status</TableTh>
                  <TableTh>Title</TableTh>
                  <TableTh>Labels</TableTh>
                </TableTr>
              </TableThead>
              <TableTbody>
                {info.issues.map((issue, i) => (
                  <TableTr
                    key={i}
                    className={
                      issue.open ? classes.issueRowOpen : classes.issueRowClosed
                    }
                  >
                    <TableTd>
                      <Link
                        href={`https://github.com/ruffle-rs/ruffle/issues/${issue.number}`}
                        target="_blank"
                      >
                        #{issue.number}
                      </Link>
                    </TableTd>
                    <TableTd>
                      <Badge color={issue.open ? "green" : "red"}>
                        {issue.open ? "Open" : "Closed"}
                      </Badge>
                    </TableTd>
                    <TableTd>
                      <Link
                        href={`https://github.com/ruffle-rs/ruffle/issues/${issue.number}`}
                        target="_blank"
                      >
                        {issue.title.length > 60
                          ? issue.title.substring(0, 57) + "..."
                          : issue.title}
                      </Link>
                    </TableTd>
                    <TableTd>{issue.labels.join(", ")}</TableTd>
                  </TableTr>
                ))}
              </TableTbody>
            </Table>
          </TabsPanel>
        </Tabs>
      </CardSection>
    </Card>
  );
}

type SortType = "totalIssues" | "openIssues" | "firstReported" | "lastReported";

const SortTypes: {
  [name in SortType]: {
    label: string;
    sortFn: (a: PanicInfo, b: PanicInfo) => number;
  };
} = {
  totalIssues: {
    label: "Sort By Total Issues",
    sortFn: (a: PanicInfo, b: PanicInfo) => b.numIssues - a.numIssues,
  },
  openIssues: {
    label: "Sort By Open Issues",
    sortFn: (a: PanicInfo, b: PanicInfo) => b.numOpenIssues - a.numOpenIssues,
  },
  firstReported: {
    label: "Sort By First Report",
    sortFn: (a: PanicInfo, b: PanicInfo) =>
      b.firstReported.getTime() - a.firstReported.getTime(),
  },
  lastReported: {
    label: "Sort By Last Report",
    sortFn: (a: PanicInfo, b: PanicInfo) =>
      b.lastReported.getTime() - a.lastReported.getTime(),
  },
};

function FilterBar({
  sort,
  setSort,
  includeOldBuilds,
  setIncludeOldBuilds,
  includeNewBuilds,
  setIncludeNewBuilds,
}: {
  sort: SortType;
  setSort: (sort: SortType) => void;
  includeOldBuilds: boolean;
  setIncludeOldBuilds: (value: boolean) => void;
  includeNewBuilds: boolean;
  setIncludeNewBuilds: (value: boolean) => void;
}) {
  return (
    <Card shadow="sm" radius="md" className={classes.filterBar}>
      <Group>
        <Checkbox
          label="Affects Old Builds"
          checked={includeOldBuilds}
          onChange={(event) => setIncludeOldBuilds(event.currentTarget.checked)}
        />
        <Checkbox
          label=" Affects New Builds"
          checked={includeNewBuilds}
          onChange={(event) => setIncludeNewBuilds(event.currentTarget.checked)}
        />
        <Select
          data={Object.entries(SortTypes).map(([name, type]) => ({
            value: name,
            label: type.label,
          }))}
          value={sort}
          onChange={(value) => setSort(value as SortType)}
          allowDeselect={false}
          classNames={{
            input: classes.sortSelectInput,
            dropdown: classes.sortSelectDropdown,
            option: classes.sortSelectOption,
          }}
        />
      </Group>
    </Card>
  );
}

// These two functions are *not* opposite. Something can affect an old and new build.
function panicAffectsOldBuild(panic: PanicInfo) {
  // It's assumed that if there was new build date, it's a *really* old build.
  return (
    panic.firstBuild === null ||
    new Date().getTime() - panic.firstBuild.getTime() >= OLD_BUILD_CUTOFF_MS
  );
}

function panicAffectsNewBuild(panic: PanicInfo) {
  return (
    panic.lastBuild !== null &&
    new Date().getTime() - panic.lastBuild.getTime() < OLD_BUILD_CUTOFF_MS
  );
}

export function PanicList({ allPanics }: { allPanics: IssuesByPanic }) {
  const [sort, setSort] = useState<SortType>("totalIssues");
  const [includeOldBuilds, setIncludeOldBuilds] = useState<boolean>(true);
  const [includeNewBuilds, setIncludeNewBuilds] = useState<boolean>(true);

  const sorted = Object.entries(allPanics)
    .filter((entry) => {
      if (!includeNewBuilds && panicAffectsNewBuild(entry[1])) {
        return false;
      }
      if (!includeOldBuilds && panicAffectsOldBuild(entry[1])) {
        return false;
      }
      return true;
    })
    .sort((a, b) => SortTypes[sort].sortFn(a[1], b[1]));

  return (
    <>
      <FilterBar
        sort={sort}
        setSort={setSort}
        includeOldBuilds={includeOldBuilds}
        includeNewBuilds={includeNewBuilds}
        setIncludeOldBuilds={setIncludeOldBuilds}
        setIncludeNewBuilds={setIncludeNewBuilds}
      />
      <Stack>
        {sorted.map(([panic, info], index) => (
          <Panic key={index} panic={panic} info={info} />
        ))}
      </Stack>
    </>
  );
}
