import { createTokenAuth } from "@octokit/auth-token";
import { createUnauthenticatedAuth } from "@octokit/auth-unauthenticated";
import { Octokit } from "octokit";

function createGithubAuth() {
  if (process.env.GITHUB_TOKEN) {
    return createTokenAuth(process.env.GITHUB_TOKEN);
  } else {
    return createUnauthenticatedAuth({
      reason:
        "Please provide a GitHub Personal Access Token via the GITHUB_TOKEN environment variable.",
    });
  }
}

export function createOctokit(): Octokit {
  return new Octokit({ authStrategy: createGithubAuth });
}

export function throwBuildError() {
  throw new Error("Build failed");
}
