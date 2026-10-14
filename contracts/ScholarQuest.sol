// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Scholar Quest
/// @notice Tracks scholarship, grant and accelerator applications as quests.
///         Each wallet owns its applications. Stages only move forward and
///         every step is stamped with the block time, so the history can't be
///         backdated. No tokens, payments or admin.
contract ScholarQuest {
    /// @dev kind: 0 Scholarship, 1 Grant, 2 Accelerator
    ///      stage: 1 Drafting, 2 Submitted, 3 Shortlisted, 4 Interview, 5 Decision
    ///      result: 0 Pending, 1 Won, 2 Not this time
    struct Application {
        string program;
        string link;
        uint8 kind;
        uint64 deadline;
        uint8 stage;
        uint8 result;
        uint64 createdAt;
    }

    uint8 public constant MAX_KIND = 2;
    uint8 public constant FINAL_STAGE = 5;
    uint256 public constant MAX_PROGRAM_LENGTH = 80;
    uint256 public constant MAX_LINK_LENGTH = 200;

    mapping(address => Application[]) private apps;
    /// @dev stageTimes[scholar][id][stage - 1] for stages 1-5, [5] when the result was set
    mapping(address => mapping(uint256 => uint64[6])) private stageTimes;

    event ApplicationAdded(address indexed scholar, uint256 indexed id, string program, uint8 kind, uint64 deadline);
    event StageAdvanced(address indexed scholar, uint256 indexed id, uint8 stage, uint64 at);
    event ApplicationFinished(address indexed scholar, uint256 indexed id, bool won);

    error EmptyProgram();
    error TextTooLong();
    error InvalidKind();
    error NoDeadline();
    error ApplicationNotFound();
    error AlreadyFinished();
    error AtFinalStage();
    error NotAtDecision();

    /// @notice Add an application to the caller's quest. It starts at stage 1 (Drafting).
    function addApplication(string calldata program, string calldata link, uint8 kind, uint64 deadline) external returns (uint256 id) {
        if (bytes(program).length == 0) revert EmptyProgram();
        if (bytes(program).length > MAX_PROGRAM_LENGTH || bytes(link).length > MAX_LINK_LENGTH) revert TextTooLong();
        if (kind > MAX_KIND) revert InvalidKind();
        if (deadline == 0) revert NoDeadline();

        uint64 at = uint64(block.timestamp);
        id = apps[msg.sender].length;
        apps[msg.sender].push(Application(program, link, kind, deadline, 1, 0, at));
        stageTimes[msg.sender][id][0] = at;

        emit ApplicationAdded(msg.sender, id, program, kind, deadline);
        emit StageAdvanced(msg.sender, id, 1, at);
    }

    /// @notice Move one of the caller's own applications to the next stage.
    function advance(uint256 id) external {
        Application storage app = _own(id);
        if (app.result != 0) revert AlreadyFinished();
        if (app.stage >= FINAL_STAGE) revert AtFinalStage();

        uint64 at = uint64(block.timestamp);
        uint8 stage = app.stage + 1;
        app.stage = stage;
        stageTimes[msg.sender][id][stage - 1] = at;

        emit StageAdvanced(msg.sender, id, stage, at);
    }

    /// @notice Set the final result. Only possible at stage 5, and it locks the application.
    function finish(uint256 id, bool won) external {
        Application storage app = _own(id);
        if (app.result != 0) revert AlreadyFinished();
        if (app.stage != FINAL_STAGE) revert NotAtDecision();

        app.result = won ? 1 : 2;
        stageTimes[msg.sender][id][5] = uint64(block.timestamp);

        emit ApplicationFinished(msg.sender, id, won);
    }

    function getApplications(address scholar) external view returns (Application[] memory) {
        return apps[scholar];
    }

    function getStageTimes(address scholar, uint256 id) external view returns (uint64[6] memory) {
        return stageTimes[scholar][id];
    }

    function _own(uint256 id) private view returns (Application storage) {
        if (id >= apps[msg.sender].length) revert ApplicationNotFound();
        return apps[msg.sender][id];
    }
}
