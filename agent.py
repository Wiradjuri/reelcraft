from anthropic import Anthropic

client = Anthropic()

session = client.beta.sessions.create(
    agent={"type": "agent", "id": "agent_01WL3PDK1nEo1cCWHG9tQFTQ"},
    environment_id="env_01HtRGBe839DVJkKsdD8uXSx",
)

with client.beta.sessions.events.stream(
    session_id=session.id,
) as stream:
    client.beta.sessions.events.send(
        session_id=session.id,
        events=[
            {
                "type": "user.message",
                "content": [{"type": "text", "text": "What are the latest developments in small modular nuclear reactors, and are they commercially viable yet?"}],
            },
        ],
    )

    for event in stream:
        if event.type == "agent.message":
            for block in event.content:
                print(block.text, end="")
        elif event.type == "agent.tool_use":
            print(f"\n[Using tool: {event.name}]")
        elif event.type == "session.status_idle":
            print("\n\nAgent finished.")
            break