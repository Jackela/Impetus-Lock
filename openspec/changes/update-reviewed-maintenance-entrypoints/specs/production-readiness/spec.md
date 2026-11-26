## ADDED Requirements

### Requirement: Verify deployment and rollback against actual running images

The deployment entry points SHALL identify both running application images, check database compatibility and readiness, and verify the selected images after a switch.

#### Scenario: A prerequisite for switching is missing

- **WHEN** the required backup fails or the selected release cannot be verified before a switch
- **THEN** the command SHALL fail before replacing the running application services.

#### Scenario: Restore a previous verified release

- **WHEN** the operator requests rollback and the prior immutable images are available and compatible with the live database
- **THEN** both services SHALL run the recorded images and pass readiness checks before rollback is reported as successful.

### Requirement: Verify the built client against the production proxy

CI SHALL exercise the built client through the production reverse proxy with the supported Web and WeChat API paths.

#### Scenario: Use the default same-origin configuration

- **WHEN** the client accesses the Web API and the Mini Program accesses its WeChat API namespace
- **THEN** the proxy SHALL forward each request to its registered FastAPI path
- **AND** development-only editor controls SHALL remain hidden in the built client.
