import { CreateGenericStory, Boolean, String } from "@rbxts/ui-labs";
import { NotificationBannerView } from "./NotificationBannerView";

const story = CreateGenericStory(
	{
		name: "In-Phone Notification Banner",
		summary: "Sliding iOS notification banner from the top notch while using the smartphone",
		controls: {
			title: String("Elena Vance"),
			message: String("Hey! Meet me at the concert hall tonight"),
			subtext: String("now"),
			badgeSymbol: String("message-square"),
			isUrgent: Boolean(false),
		},
	},
	(props) => {
		const phoneWrapper = new Instance("Frame");
		phoneWrapper.Name = "StoryPhoneMockup";
		phoneWrapper.Size = new UDim2(0, 320, 0, 620);
		phoneWrapper.AnchorPoint = new Vector2(0.5, 0.5);
		phoneWrapper.Position = new UDim2(0.5, 0, 0.5, 0);
		phoneWrapper.BackgroundColor3 = Color3.fromHex("#0c0c0c");
		phoneWrapper.ClipsDescendants = true;
		phoneWrapper.Parent = props.target;

		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0, 36);
		corner.Parent = phoneWrapper;

		const banner = new NotificationBannerView(phoneWrapper);

		const triggerBanner = (c: typeof props.controls) => {
			banner.show({
				title: c.title,
				message: c.message,
				subtext: c.subtext,
				badgeIcon: c.badgeSymbol,
				badgeColor: Color3.fromHex("#2e2e2e"),
				duration: 9999, // Keep visible for testing in UI Labs
				isUrgent: c.isUrgent,
			});
		};

		triggerBanner(props.controls);

		const unsubscribe = props.subscribe((controls) => {
			triggerBanner(controls);
		});

		return () => {
			unsubscribe();
			banner.destroy();
			phoneWrapper.Destroy();
		};
	},
);

export = story;
