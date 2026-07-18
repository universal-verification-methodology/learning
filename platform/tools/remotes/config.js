// Sandbox GitHub URLs for the remotes lab.
// Map expands as more courses get sandboxes under the same org.
window.UNIX_GIT_SANDBOX = {
  practiceRepo: "https://github.com/universal-verification-methodology/unix-git-practice",
  // Create/publish when you add the submodule lab:
  sharedIpRepo: "https://github.com/universal-verification-methodology/unix-git-shared-ip",
  practiceRepoSsh: "git@github.com:universal-verification-methodology/unix-git-practice.git",
  sharedIpRepoSsh: "git@github.com:universal-verification-methodology/unix-git-shared-ip.git",
  defaultBranch: "main",
};

// Future multi-course shape (remotes lab can switch to this later):
window.COURSE_SANDBOXES = {
  "unix-git": window.UNIX_GIT_SANDBOX,
};
