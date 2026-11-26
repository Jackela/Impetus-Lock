## ADDED Requirements

### Requirement: Coordinated runtime and dependency validation

The application SHALL build and run on the production interpreters selected by its Dockerfiles. The locked dependencies SHALL continue to support the maintained Python and Node versions documented in the development guide.

#### Scenario: A runtime or provider crosses a major version

- **WHEN** a maintainer upgrades the production runtime or a provider integration
- **THEN** CI SHALL validate the application on its production runtime and retain the documented Python compatibility checks
- **AND** the provider contract, stored password authentication, browser flows and application build SHALL pass with the new locks.
