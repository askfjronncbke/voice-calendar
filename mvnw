#!/bin/sh
# ----------------------------------------------------------------------------
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#    https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# ----------------------------------------------------------------------------

# Maven Wrapper Start Script

# Resolve links - $0 may be a softlink
PRG="$0"
while [ -h "$PRG" ]; do
  ls=$(ls -ld "$PRG")
  link=$(expr "$ls" : '.*-> \(.*\)$')
  if expr "$link" : '.*/.*' > /dev/null; then
    PRG="$link"
  else
    PRG=$(dirname "$PRG")/"$link"
  fi
done

# Get standard environment variables
PRGDIR=$(dirname "$PRG")

# Only set MAVEN_HOME if not already set
[ -z "$MAVEN_HOME" ] && MAVEN_HOME=$(cd "$PRGDIR/../.mvn/wrapper/maven-wrapper" 2>/dev/null && pwd -P) || true

# Use `maven.home` from .mvn/maven.config or -Dmaven.home if set
if [ -f "$PRGDIR/.mvn/maven.config" ]; then
  MAVEN_HOME=$(grep -E '^\s*maven\.home' "$PRGDIR/.mvn/maven.config" | head -1 | sed 's/^\s*maven\.home\s*=\s*//')
fi

# Resolve Java command
if [ -z "$JAVA_HOME" ]; then
  JAVA_COMMAND="java"
else
  JAVA_COMMAND="$JAVA_HOME/bin/java"
fi

# Set up classpath
CLASSWORLDS_JAR="$PRGDIR/.mvn/wrapper/maven-wrapper.jar"

# Exec Maven
exec "$JAVA_COMMAND" \
  -Xms64m -Xmx512m \
  -classpath "$CLASSWORLDS_JAR" \
  "-Dmaven.home=${MAVEN_HOME}" \
  "-Dmaven.multiModuleProjectDirectory=${PRGDIR}" \
  org.apache.maven.wrapper.MavenWrapperMain \
  "$@"
