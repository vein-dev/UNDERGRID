import { Choose, CreateGenericStory, String } from "@rbxts/ui-labs";
import { ChatApp } from "./ChatApp";

const story = CreateGenericStory(
	{
		name: "Messages App",
		summary: "iOS Messages direct messaging app with contacts list and direct conversation bubble view",
		controls: {
			viewMode: Choose(["Conversation", "ContactsList"], 1),
			contactName: String("Elena Vance"),
		},
	},
	(props) => {
		const phoneWrapper = new Instance("Frame");
		phoneWrapper.Size = new UDim2(0, 340, 0, 680);
		phoneWrapper.AnchorPoint = new Vector2(0.5, 0.5);
		phoneWrapper.Position = new UDim2(0.5, 0, 0.5, 0);
		phoneWrapper.BackgroundColor3 = Color3.fromHex("#0c0c0c");
		phoneWrapper.ClipsDescendants = true;
		phoneWrapper.Parent = props.target;

		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0, 36);
		corner.Parent = phoneWrapper;

		const chatApp = new ChatApp(phoneWrapper);
		chatApp.show();

		const applyMode = (c: typeof props.controls) => {
			if (c.viewMode === "Conversation") {
				chatApp.openConversationWithUserId(1, c.contactName, "@" + c.contactName.lower().gsub(" ", "_")[0]);
			} else {
				chatApp.show();
			}
		};

		applyMode(props.controls);

		const unsubscribe = props.subscribe((controls) => {
			applyMode(controls);
		});

		return () => {
			unsubscribe();
			chatApp.destroy();
			phoneWrapper.Destroy();
		};
	},
);

export = story;
