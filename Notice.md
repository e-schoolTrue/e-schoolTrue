# Issue with *Red Hat Dependency Analytics Extension*

## Problem Statement: the issue is that the project reference itself as a local dependency, so this will lead to recursive building which will end up crashing build task

## Solution: Uninstall this extension, delete package-lock.json, node_modules, and install dependencies.