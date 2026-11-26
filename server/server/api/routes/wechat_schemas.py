"""Mini-program request bodies and public response field lists."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator

Identifier = Annotated[str, Field(min_length=1, max_length=128)]
Version = Annotated[int, Field(strict=True, ge=0)]
Theme = Literal["letter", "detective"]
Mode = Literal["normal", "high", "custom"]
InputSource = Literal["choice", "keyboard", "voice"]
Style = Literal["verbatim", "voice", "polish"]
Ability = Literal["returning", "interpret", "skip", "toggle_returning", "toggle_interpret", "keep"]
RuleTrigger = Literal["manual", "response", "automatic"]
RuleAction = Literal["insert", "rewrite", "delete"]
Kind = Literal[
    "turn",
    "ability",
    "edit",
    "unlock",
    "replace",
    "begin_finish",
    "resume",
    "finish",
    "restore",
    "restyle",
    "intervene",
    "cancel",
]


class InputBody(BaseModel):
    """Only accept documented fields, including on requests to change state."""

    model_config = ConfigDict(extra="forbid")


class Login(InputBody):
    """One-time code obtained from wx.login."""

    code: Annotated[str, Field(min_length=1, max_length=512)]


class SessionView(BaseModel):
    """Application session returned after identity exchange."""

    token: str
    subject: str


class Start(InputBody):
    """Start an owned run, optionally from a published card or saved mode."""

    request_id: Identifier
    theme: Theme
    mode: Mode
    opening: Annotated[str, Field(min_length=1, max_length=8000)] | None = None
    mode_id: Identifier | None = None
    card_id: Identifier | None = None
    accept_irreversible: StrictBool = False
    accept_high: StrictBool = False


class Action(InputBody):
    """Versioned command issued by the writer."""

    request_id: Identifier
    version: Version
    kind: Kind
    retain: StrictBool = False
    source: InputSource | None = None
    text: Annotated[str, Field(max_length=16000)] | None = None
    target: Identifier | None = None
    style: Style | None = None
    ability: Ability | None = None
    interpretation: Annotated[str, Field(max_length=4000)] | None = None

    @model_validator(mode="after")
    def require_turn_input(self) -> "Action":
        """Require an explicit input source and actual content before generating a turn."""
        if self.kind == "turn" and (not self.source or not (self.text or "").strip()):
            raise ValueError("续写需要选择输入方式并提供内容")
        if self.kind == "restyle" and (
            not self.style or not self.target or not (self.text or "").strip()
        ):
            raise ValueError("请先预览并确认要保存的口述文字")
        return self


class EditWork(InputBody):
    """A new version of a private work."""

    version: Version
    title: Annotated[str, Field(max_length=255)]
    text: Annotated[str, Field(max_length=1_000_000)]


class Publish(InputBody):
    """Explicit authorization to publish exactly the previewed work version."""

    request_id: Identifier
    version: Version


class NewMode(InputBody):
    """A named rule configuration to create or replace for later runs."""

    name: Annotated[str, Field(min_length=1, max_length=80)]
    trigger: RuleTrigger
    action: RuleAction
    lock: StrictBool
    recoverable: StrictBool


class CardView(BaseModel):
    """Fields visible to every holder of a published card."""

    id: str
    title: str
    text: str
    theme: Theme
    mode: Mode
    challenge_id: str
    rules_version: int
    ai_generated: bool
    requires_consent: bool
    opening: str
    rules: str


class CardList(BaseModel):
    """Owner's active share cards for one work."""

    cards: list[CardView]


class SegmentView(BaseModel):
    """Current text and private recovery information for an owned segment."""

    id: str
    text: str
    locked: bool
    source: str
    original: str | None = None
    ai_generated: bool = False


class RecoveryView(BaseModel):
    """Original text and its position when the run allows recovery."""

    id: str
    target: str
    segment: SegmentView
    index: int
    previous_id: str | None = None
    following_id: str | None = None
    replacement: str | None = None


class RunRulesView(BaseModel):
    """Personal rules captured at the start of a run, empty for built-in modes."""

    trigger: RuleTrigger | None = None
    action: RuleAction | None = None
    lock: bool | None = None
    recoverable: bool | None = None


class AbilityView(BaseModel):
    """Current level and activation of a story ability."""

    level: int
    enabled: bool


class RunView(BaseModel):
    """An owned run including the rule engine's current narrative state."""

    id: str
    version: int
    theme: Theme
    mode: Mode
    opening: str
    rules: RunRulesView = Field(default_factory=RunRulesView)
    segments: list[SegmentView]
    choices: list[str]
    offers: list[str]
    abilities: dict[str, AbilityView]
    lock_uses: int
    turns: int
    responses: int = 0
    status: Literal["active", "finished"]
    finishing: bool = False
    waiting_response: bool = False
    generation_pending: bool = False
    pending_intervention: bool = False
    interpretation_options: list[str] = Field(default_factory=list)
    interpretations: list[str] = Field(default_factory=list)
    interpretation: str | None = None
    recoveries: list[RecoveryView] = Field(default_factory=list)
    work_id: str | None = None


class WorkView(BaseModel):
    """Private manuscript fields for editing, exporting and publication preview."""

    id: str
    version: int
    title: str
    text: str
    theme: Theme
    mode: Mode
    challenge_id: str
    rules_version: int
    ai_generated: bool
    opening: str
    rules: str
    requires_consent: bool


class ModeView(NewMode):
    """The stored recipe for a future personal challenge."""

    id: str


class DiscoveryView(BaseModel):
    """Persistent discoveries earned by this author."""

    completed: int
    detective: bool
    high: bool
    rewrite: bool
    delete: bool


class LibraryView(BaseModel):
    """Owned drafts, finished works, reusable rules and discovered privileges."""

    runs: list[RunView]
    works: list[WorkView]
    modes: list[ModeView]
    progress: DiscoveryView


class Preview(InputBody):
    """A non-mutating request for one candidate at an exact run version."""

    version: Version
    target: Identifier
    kind: Literal["restyle", "replace", "rewrite", "insert"]
    style: Style = "voice"


class PreviewView(BaseModel):
    """Text that the writer can review before issuing a versioned action."""

    version: int
    target: str
    text: str


class ReceiptView(BaseModel):
    """Current state of an action without any historical text from the draft."""

    status: Literal["unknown", "pending", "committed", "canceled"]
    run_version: int


class ActionConflictDetails(BaseModel):
    """Owner-only command IDs that must be resolved before finishing a run."""

    model_config = ConfigDict(extra="allow")
    request_ids: list[str] | None = None


class ActionConflictError(BaseModel):
    """An application error for a stale or unresolved action."""

    code: str
    message: str
    details: ActionConflictDetails | None


class ActionConflictView(BaseModel):
    """The application's structured HTTP 409 response for an action."""

    error: ActionConflictError
