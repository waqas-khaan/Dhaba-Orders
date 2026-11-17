FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src

COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 --create-home app
WORKDIR /app
COPY --from=build --chown=app:app /src/target/kitchen-worker-1.0.0.jar /app/app.jar

USER 10001
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s \
  CMD ["sh", "-c", "grep -q 'app.jar' /proc/1/cmdline"]
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
