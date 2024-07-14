import {
  Badge,
  Card,
  CardSection,
  Code,
  Container,
  Group,
  List,
  ListItem,
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
import React from "react";
import { getAllOpenPanics, PanicInfo } from "@/app/issues/panics";
import classes from "./issues.module.css";
import Link from "next/link";

const OLD_BUILD_CUTOFF_MS = 180 * 24 * 60 * 60 * 1000;

function Panic({ panic, info }: { panic: string; info: PanicInfo }) {
  const title = panic.replace(/\n[^]+$/, "");
  const oldBuild =
    info.lastBuild === null ||
    new Date().getTime() - info.lastBuild.getTime() >= OLD_BUILD_CUTOFF_MS;
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
                  {oldBuild && <Badge color="red">Old Builds</Badge>}
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

export default async function Page() {
  const { allPanics } = await getAllOpenPanics();
  const sorted = Object.entries(allPanics).sort(
    (a, b) => b[1].numIssues - a[1].numIssues,
  );
  return (
    <Container size="xl">
      <Stack>
        {sorted.map(([panic, info], index) => (
          <Panic key={index} panic={panic} info={info} />
        ))}
      </Stack>
    </Container>
  );
}
