import { createOctokit } from "@/github_auth";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { readFile, writeFile } from "node:fs/promises";
import { fileExists } from "next/dist/lib/file-exists";

interface PanicSummary {
  buildTime: Date | null;
}

interface Panic extends PanicSummary {
  errorStack: string | null;
  avm2Stack: string | null;
  errorMessage: string;
  swfUrl: string | null;
  pageUrl: string | null;
  commit: string | null;
}

interface Issue {
  number: number;
  open: boolean;
  created: Date;
  title: string;
  labels: string[];
}

export type IssueWithOptionalPanic = Issue & { panic: Panic | null };
export type IssueWithPanicSummary = Issue & {
  panic: PanicSummary;
};

type GithubIssue =
  RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"][number];

function findMatch(regex: RegExp, contents: string): string | null {
  const match = contents.match(regex);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

function findPanic(contents: string): Panic | null {
  // Some reports somehow contain \r...
  contents = contents.replaceAll("\r", "");

  // e.g. /rustc/82e1608dfa6e0b5569232559e3d385fea5a93112/library/std/src/sys/wasm/../unsupported/locks/mutex.rs
  contents = contents.replaceAll(
    /\/rustc\/([a-z0-9]+)\/library/g,
    "/rustc/.../library",
  );

  // e.g. LoaderInfoObject { ptr: 0x58bfab8 }
  contents = contents.replaceAll(/ptr: 0x([a-f0-9]+)/g, "ptr: 0x...");

  const likelyHasError = contents.indexOf("# Error Info\n") > -1;

  const commit = findMatch(/Commit: (\S+)/, contents);
  const swfUrl = findMatch(/SWF URL: ([^]+?)\n/, contents);
  const pageUrl = findMatch(/Page URL: ([^]+?)\n/, contents);
  const errorStack = findMatch(/Error stack:\n```\n([^]+?)\n```/, contents);
  const avm2Stack = findMatch(/AVM2 stack:\n```\n([^]+?)\n```/, contents);

  let errorMessage = findMatch(
    /Error message: ([^]+?)\n(?:Error stack|\n#)/,
    contents,
  );
  if (!errorMessage) {
    // Old style of error message
    errorMessage = findMatch(/Error: ([^]+?)\n\n/, contents);
  }

  const buildTimeStr = findMatch(/Built: (\S+)/, contents);
  let buildTime: Date | null = null;
  if (buildTimeStr) {
    buildTime = new Date(buildTimeStr);
  }

  if (errorMessage) {
    if (likelyHasError || errorStack || avm2Stack) {
      return {
        commit,
        buildTime,
        swfUrl,
        pageUrl,
        errorStack,
        avm2Stack,
        errorMessage,
      };
    }
  }

  return null;
}

function processIssue(issue: GithubIssue): IssueWithOptionalPanic {
  return {
    number: issue.number,
    open: issue.state === "open",
    created: new Date(issue.created_at),
    panic: findPanic(issue.body ?? ""),
    title: issue.title,
    labels: issue.labels
      .map((label) => (typeof label === "string" ? label : label.name ?? ""))
      .filter((label) => label),
  };
}

const getAllIssues = async () => {
  const octokit = createOctokit();
  const processedIssues: IssueWithOptionalPanic[] = [];
  const iterator = octokit.paginate.iterator(octokit.rest.issues.listForRepo, {
    owner: "ruffle-rs",
    repo: "ruffle",
    per_page: 100,
    state: "all",
  });

  for await (const { data: issues } of iterator) {
    for (const issue of issues) {
      if (!issue.pull_request) {
        processedIssues.push(processIssue(issue));
      }
    }
  }

  return processedIssues;
};

/// For use in development so it doesn't try to fetch all issues every page load...
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getAllIssuesCached = async () => {
  if (!(await fileExists("issues.json"))) {
    const issues = await getAllIssues();
    await writeFile("issues.json", JSON.stringify(issues), "utf8");
    return issues;
  }
  const issues = JSON.parse(
    await readFile("issues.json", "utf8"),
  ) as IssueWithOptionalPanic[];
  for (const issue of issues) {
    issue.created = new Date(issue.created);
    if (issue.panic?.buildTime) {
      issue.panic.buildTime = new Date(issue.panic.buildTime);
    }
  }
  return issues;
};

export type IssuesByPanic = {
  [message: string]: PanicInfo;
};

export interface PanicInfo {
  issues: IssueWithPanicSummary[];
  numIssues: number;
  numOpenIssues: number;
  firstReported: Date;
  lastReported: Date;
  firstBuild: Date | null;
  lastBuild: Date | null;
}

export async function getAllOpenPanics() {
  const result: IssuesByPanic = {};
  let totalIssues = 0;
  let totalOpenIssues = 0;
  const issues = await getAllIssues();

  for (const issue of issues) {
    totalIssues++;
    if (issue.open) {
      totalOpenIssues++;
    }

    if (issue.panic) {
      if (!(issue.panic.errorMessage in result)) {
        result[issue.panic.errorMessage] = {
          firstBuild: issue.panic.buildTime,
          firstReported: issue.created,
          lastBuild: issue.panic.buildTime,
          lastReported: issue.created,
          issues: [],
          numIssues: 0,
          numOpenIssues: 0,
        };
      }
      const panicInfo = result[issue.panic.errorMessage];
      panicInfo.numIssues += 1;
      panicInfo.issues.push({
        panic: {
          buildTime: issue.panic.buildTime,
        },
        created: issue.created,
        open: issue.open,
        number: issue.number,
        labels: issue.labels,
        title: issue.title,
      });
      if (issue.open) {
        panicInfo.numOpenIssues += 1;
      }
      if (issue.created < panicInfo.firstReported) {
        panicInfo.firstReported = issue.created;
      }
      if (issue.created > panicInfo.lastReported) {
        panicInfo.lastReported = issue.created;
      }
      if (issue.panic.buildTime) {
        if (
          panicInfo.firstBuild === null ||
          issue.panic.buildTime < panicInfo.firstBuild
        ) {
          panicInfo.firstBuild = issue.panic.buildTime;
        }
        if (
          panicInfo.lastBuild === null ||
          issue.panic.buildTime > panicInfo.lastBuild
        ) {
          panicInfo.lastBuild = issue.panic.buildTime;
        }
      }
    }
  }

  for (const errorMessage of Object.keys(result)) {
    if (result[errorMessage]?.numOpenIssues === 0) {
      delete result[errorMessage];
    }
  }

  return { totalIssues, totalOpenIssues, allPanics: result };
}
