import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { EventService } from "client/services/EventService";
import { Fonts } from "../Typography";
import { EventData, RsvpStatus } from "shared/types";
import { LucideIcon } from "../components/LucideIcon";

export interface EventComponentProps {
	visible: boolean;
	onBack: () => void;
}

export function EventComponent({ visible, onBack }: EventComponentProps) {
	const eventService = EventService.getInstance();
	const localPlayer = Players.LocalPlayer;

	const [events, setEvents] = useState<EventData[]>(() => eventService.getEvents());
	const [activeEvent, setActiveEvent] = useState<EventData | undefined>(undefined);

	useEffect(() => {
		eventService.fetchEvents().then((evts) => {
			setEvents(evts);
		});

		const unsubEvents = eventService.onEventsUpdated((evts) => {
			setEvents([...evts]);
		});

		const unsubRsvp = eventService.onRsvpChanged((eventId, going, interested) => {
			setEvents((prev) =>
				prev.map((e) => (e.id === eventId ? { ...e, goingUserIds: going, interestedUserIds: interested } : e)),
			);
			setActiveEvent((prev) =>
				prev && prev.id === eventId ? { ...prev, goingUserIds: going, interestedUserIds: interested } : prev,
			);
		});

		return () => {
			unsubEvents();
			unsubRsvp();
		};
	}, []);

	if (!visible) return <></>;

	// Helper to check if event has valid uploaded poster
	const isPosterValid = (assetId: string) => assetId !== "" && assetId !== "rbxassetid://0";

	// ─── 1. Event Detail View (Referens: Screenshot 2) ────────────────────────
	if (activeEvent) {
		const isGoing = localPlayer !== undefined && activeEvent.goingUserIds.includes(localPlayer.UserId);
		const isInterested = localPlayer !== undefined && activeEvent.interestedUserIds.includes(localPlayer.UserId);
		const hasValidPoster = isPosterValid(activeEvent.posterAssetId);

		return (
			<frame
				key="EventDetail"
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundColor3={Color3.fromHex("#0c0c0c")}
				ZIndex={8}
			>
				{/* Top Header */}
				<frame
					key="Header"
					Size={new UDim2(1, 0, 0, 48)}
					BackgroundColor3={Color3.fromHex("#0c0c0c")}
					ZIndex={9}
				>
					<uistroke Color={Color3.fromHex("#1a1a1a")} Thickness={1} />
					<textbutton
						key="BackBtn"
						AnchorPoint={new Vector2(0, 0.5)}
						Position={new UDim2(0, 12, 0.5, 0)}
						Size={new UDim2(0, 32, 0, 32)}
						BackgroundTransparency={1}
						Text=""
						AutoButtonColor={false}
						ZIndex={10}
						Event={{
							Activated: () => setActiveEvent(undefined),
							MouseButton1Click: () => setActiveEvent(undefined),
						}}
					>
						<LucideIcon
							name="chevron-left"
							size={new UDim2(0, 18, 0, 18)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={Color3.fromHex("#ffffff")}
							zIndex={10}
						/>
					</textbutton>

					<textlabel
						key="Title"
						Position={new UDim2(0, 48, 0, 0)}
						Size={new UDim2(1, -96, 1, 0)}
						BackgroundTransparency={1}
						Text="Event Detail"
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Bold}
						TextSize={14}
						TextXAlignment={Enum.TextXAlignment.Center}
						ZIndex={10}
					/>
				</frame>

				{/* Detail Scrolling Content */}
				<scrollingframe
					key="DetailScroll"
					Position={new UDim2(0, 0, 0, 48)}
					Size={new UDim2(1, 0, 1, -112)}
					BackgroundTransparency={1}
					ScrollBarThickness={2}
					ScrollBarImageColor3={Color3.fromHex("#2a2a2a")}
					CanvasSize={new UDim2(0, 0, 0, 0)}
					AutomaticCanvasSize={Enum.AutomaticSize.Y}
					ZIndex={9}
				>
					<uilistlayout Padding={new UDim(0, 14)} SortOrder={Enum.SortOrder.LayoutOrder} />
					<uipadding
						PaddingTop={new UDim(0, 12)}
						PaddingBottom={new UDim(0, 24)}
						PaddingLeft={new UDim(0, 16)}
						PaddingRight={new UDim(0, 16)}
					/>

					{/* 1. Poster Banner / Placeholder Container */}
					<frame
						key="Banner"
						LayoutOrder={1}
						Size={new UDim2(1, 0, 0, 148)}
						BackgroundColor3={Color3.fromHex("#141414")}
						ZIndex={10}
					>
						<uicorner CornerRadius={new UDim(0, 14)} />
						<uistroke Color={Color3.fromHex("#1e1e1e")} Thickness={1} />

						{hasValidPoster ? (
							<imagelabel
								key="PosterImg"
								Size={new UDim2(1, 0, 1, 0)}
								BackgroundTransparency={1}
								Image={activeEvent.posterAssetId}
								ScaleType={Enum.ScaleType.Crop}
								ZIndex={11}
							>
								<uicorner CornerRadius={new UDim(0, 14)} />
							</imagelabel>
						) : (
							/* Placeholder: EVENT POSTER label + Ticket Icon */
							<frame
								key="PlaceholderContent"
								AnchorPoint={new Vector2(0.5, 0.5)}
								Position={new UDim2(0.5, 0, 0.5, 0)}
								Size={new UDim2(1, 0, 0, 56)}
								BackgroundTransparency={1}
								ZIndex={11}
							>
								<uilistlayout
									FillDirection={Enum.FillDirection.Vertical}
									HorizontalAlignment={Enum.HorizontalAlignment.Center}
									VerticalAlignment={Enum.VerticalAlignment.Center}
									Padding={new UDim(0, 8)}
									SortOrder={Enum.SortOrder.LayoutOrder}
								/>
								<textlabel
									key="PlaceholderLabel"
									LayoutOrder={1}
									BackgroundTransparency={1}
									AutomaticSize={Enum.AutomaticSize.XY}
									Text="EVENT POSTER"
									TextColor3={Color3.fromHex("#555555")}
									Font={Fonts.Bold}
									TextSize={11}
									ZIndex={12}
								/>
								<LucideIcon
									name="ticket"
									size={new UDim2(0, 24, 0, 24)}
									color={Color3.fromHex("#444444")}
									zIndex={12}
									layoutOrder={2}
								/>
							</frame>
						)}

						{/* Top-Left Pill Badge (e.g. FREE ENTRY) */}
						<frame
							key="Badge"
							Position={new UDim2(0, 12, 0, 12)}
							Size={new UDim2(0, 0, 0, 22)}
							AutomaticSize={Enum.AutomaticSize.X}
							BackgroundColor3={Color3.fromHex("#222222")}
							ZIndex={13}
						>
							<uicorner CornerRadius={new UDim(0, 6)} />
							<uipadding PaddingLeft={new UDim(0, 8)} PaddingRight={new UDim(0, 8)} />
							<textlabel
								key="BadgeText"
								Size={new UDim2(1, 0, 1, 0)}
								BackgroundTransparency={1}
								Text={activeEvent.priceText.upper()}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Bold}
								TextSize={9}
								ZIndex={14}
							/>
						</frame>
					</frame>

					{/* 2. Category, Title & Organizer */}
					<frame
						key="TitleBlock"
						LayoutOrder={2}
						Size={new UDim2(1, 0, 0, 0)}
						AutomaticSize={Enum.AutomaticSize.Y}
						BackgroundTransparency={1}
						ZIndex={10}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Vertical}
							Padding={new UDim(0, 4)}
							SortOrder={Enum.SortOrder.LayoutOrder}
						/>
						<textlabel
							key="Category"
							LayoutOrder={1}
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text={activeEvent.category.upper()}
							TextColor3={Color3.fromHex("#707070")}
							Font={Fonts.Bold}
							TextSize={10}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={11}
						/>
						<textlabel
							key="Title"
							LayoutOrder={2}
							Size={new UDim2(1, 0, 0, 0)}
							AutomaticSize={Enum.AutomaticSize.Y}
							BackgroundTransparency={1}
							Text={activeEvent.title}
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={17}
							TextWrapped={true}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={11}
						/>
						<textlabel
							key="Organizer"
							LayoutOrder={3}
							Size={new UDim2(1, 0, 0, 16)}
							BackgroundTransparency={1}
							Text={`Organized by ${activeEvent.organizerName}`}
							TextColor3={Color3.fromHex("#777777")}
							Font={Fonts.Regular}
							TextSize={11}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={11}
						/>
					</frame>

					{/* 3. Event Schedule & Location Card */}
					<frame
						key="InfoCard"
						LayoutOrder={3}
						Size={new UDim2(1, 0, 0, 0)}
						AutomaticSize={Enum.AutomaticSize.Y}
						BackgroundColor3={Color3.fromHex("#121212")}
						ZIndex={10}
					>
						<uicorner CornerRadius={new UDim(0, 12)} />
						<uistroke Color={Color3.fromHex("#1e1e1e")} Thickness={1} />
						<uipadding
							PaddingTop={new UDim(0, 12)}
							PaddingBottom={new UDim(0, 12)}
							PaddingLeft={new UDim(0, 14)}
							PaddingRight={new UDim(0, 14)}
						/>
						<uilistlayout
							FillDirection={Enum.FillDirection.Vertical}
							Padding={new UDim(0, 8)}
							SortOrder={Enum.SortOrder.LayoutOrder}
						/>

						{/* Date */}
						<frame
							key="DateRow"
							LayoutOrder={1}
							Size={new UDim2(1, 0, 0, 16)}
							BackgroundTransparency={1}
							ZIndex={11}
						>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 8)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							<LucideIcon
								name="calendar"
								size={new UDim2(0, 13, 0, 13)}
								color={Color3.fromHex("#777777")}
								zIndex={12}
								layoutOrder={1}
							/>
							<textlabel
								key="DateText"
								LayoutOrder={2}
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text={activeEvent.dateText}
								TextColor3={Color3.fromHex("#aaaaaa")}
								Font={Fonts.Regular}
								TextSize={11}
								ZIndex={12}
							/>
						</frame>

						{/* Time */}
						<frame
							key="TimeRow"
							LayoutOrder={2}
							Size={new UDim2(1, 0, 0, 16)}
							BackgroundTransparency={1}
							ZIndex={11}
						>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 8)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							<LucideIcon
								name="clock"
								size={new UDim2(0, 13, 0, 13)}
								color={Color3.fromHex("#777777")}
								zIndex={12}
								layoutOrder={1}
							/>
							<textlabel
								key="TimeText"
								LayoutOrder={2}
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text={activeEvent.timeText}
								TextColor3={Color3.fromHex("#aaaaaa")}
								Font={Fonts.Regular}
								TextSize={11}
								ZIndex={12}
							/>
						</frame>

						{/* Location */}
						<frame
							key="LocRow"
							LayoutOrder={3}
							Size={new UDim2(1, 0, 0, 16)}
							BackgroundTransparency={1}
							ZIndex={11}
						>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 8)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							<LucideIcon
								name="map-pin"
								size={new UDim2(0, 13, 0, 13)}
								color={Color3.fromHex("#777777")}
								zIndex={12}
								layoutOrder={1}
							/>
							<textlabel
								key="LocText"
								LayoutOrder={2}
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text={activeEvent.locationText}
								TextColor3={Color3.fromHex("#aaaaaa")}
								Font={Fonts.Regular}
								TextSize={11}
								ZIndex={12}
							/>
						</frame>
					</frame>

					{/* 4. Attendance Stats Card (Going / Interested with divider) */}
					<frame
						key="StatsCard"
						LayoutOrder={4}
						Size={new UDim2(1, 0, 0, 56)}
						BackgroundColor3={Color3.fromHex("#121212")}
						ZIndex={10}
					>
						<uicorner CornerRadius={new UDim(0, 12)} />
						<uistroke Color={Color3.fromHex("#1e1e1e")} Thickness={1} />

						{/* Left: Going */}
						<frame key="GoingSide" Size={new UDim2(0.5, -1, 1, 0)} BackgroundTransparency={1} ZIndex={11}>
							<uilistlayout
								FillDirection={Enum.FillDirection.Vertical}
								HorizontalAlignment={Enum.HorizontalAlignment.Center}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 2)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							<textlabel
								key="GoingNum"
								LayoutOrder={1}
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text={tostring(activeEvent.goingUserIds.size())}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Bold}
								TextSize={15}
								ZIndex={12}
							/>
							<textlabel
								key="GoingLbl"
								LayoutOrder={2}
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text="Going"
								TextColor3={Color3.fromHex("#cccccc")}
								Font={Fonts.Bold}
								TextSize={11}
								ZIndex={12}
							/>
						</frame>

						{/* Center Divider */}
						<frame
							key="Divider"
							AnchorPoint={new Vector2(0.5, 0.5)}
							Position={new UDim2(0.5, 0, 0.5, 0)}
							Size={new UDim2(0, 1, 0.6, 0)}
							BackgroundColor3={Color3.fromHex("#262626")}
							BorderSizePixel={0}
							ZIndex={11}
						/>

						{/* Right: Interested */}
						<frame
							key="InterestedSide"
							Position={new UDim2(0.5, 1, 0, 0)}
							Size={new UDim2(0.5, -1, 1, 0)}
							BackgroundTransparency={1}
							ZIndex={11}
						>
							<uilistlayout
								FillDirection={Enum.FillDirection.Vertical}
								HorizontalAlignment={Enum.HorizontalAlignment.Center}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 2)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							<textlabel
								key="InterestedNum"
								LayoutOrder={1}
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text={tostring(activeEvent.interestedUserIds.size())}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Bold}
								TextSize={15}
								ZIndex={12}
							/>
							<textlabel
								key="InterestedLbl"
								LayoutOrder={2}
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text="Interested"
								TextColor3={Color3.fromHex("#cccccc")}
								Font={Fonts.Bold}
								TextSize={11}
								ZIndex={12}
							/>
						</frame>
					</frame>

					{/* 5. About this Event */}
					<frame
						key="AboutBlock"
						LayoutOrder={5}
						Size={new UDim2(1, 0, 0, 0)}
						AutomaticSize={Enum.AutomaticSize.Y}
						BackgroundTransparency={1}
						ZIndex={10}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Vertical}
							Padding={new UDim(0, 6)}
							SortOrder={Enum.SortOrder.LayoutOrder}
						/>
						<textlabel
							key="AboutHeading"
							LayoutOrder={1}
							Size={new UDim2(1, 0, 0, 18)}
							BackgroundTransparency={1}
							Text="About this Event"
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={13}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={11}
						/>
						<textlabel
							key="AboutBody"
							LayoutOrder={2}
							Size={new UDim2(1, 0, 0, 0)}
							AutomaticSize={Enum.AutomaticSize.Y}
							BackgroundTransparency={1}
							Text={activeEvent.description}
							TextColor3={Color3.fromHex("#909090")}
							Font={Fonts.Regular}
							TextSize={11}
							LineHeight={1.18}
							TextWrapped={true}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={11}
						/>
					</frame>
				</scrollingframe>

				{/* Bottom Action Footer (Going & Interested Buttons) */}
				<frame
					key="BottomFooter"
					Position={new UDim2(0, 0, 1, -64)}
					Size={new UDim2(1, 0, 0, 64)}
					BackgroundColor3={Color3.fromHex("#0c0c0c")}
					ZIndex={9}
				>
					<uistroke Color={Color3.fromHex("#1a1a1a")} Thickness={1} />
					<uipadding
						PaddingTop={new UDim(0, 12)}
						PaddingBottom={new UDim(0, 12)}
						PaddingLeft={new UDim(0, 16)}
						PaddingRight={new UDim(0, 16)}
					/>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						Padding={new UDim(0, 10)}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{/* Going CTA Button */}
					<textbutton
						key="GoingBtn"
						LayoutOrder={1}
						Size={new UDim2(0.5, -5, 1, 0)}
						BackgroundColor3={isGoing ? Color3.fromHex("#ffffff") : Color3.fromHex("#1a1a1a")}
						Text=""
						AutoButtonColor={false}
						ZIndex={10}
						Event={{
							Activated: () => {
								eventService.setRsvp(activeEvent.id, isGoing ? RsvpStatus.None : RsvpStatus.Going);
							},
							MouseButton1Click: () => {
								eventService.setRsvp(activeEvent.id, isGoing ? RsvpStatus.None : RsvpStatus.Going);
							},
						}}
					>
						<uicorner CornerRadius={new UDim(0, 12)} />
						<uistroke
							Color={isGoing ? Color3.fromHex("#ffffff") : Color3.fromHex("#282828")}
							Thickness={1}
						/>
						<textlabel
							key="Label"
							Size={new UDim2(1, 0, 1, 0)}
							BackgroundTransparency={1}
							Text="Going"
							TextColor3={isGoing ? Color3.fromHex("#000000") : Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={13}
							ZIndex={11}
						/>
					</textbutton>

					{/* Interested CTA Button */}
					<textbutton
						key="InterestedBtn"
						LayoutOrder={2}
						Size={new UDim2(0.5, -5, 1, 0)}
						BackgroundColor3={isInterested ? Color3.fromHex("#ffffff") : Color3.fromHex("#1a1a1a")}
						Text=""
						AutoButtonColor={false}
						ZIndex={10}
						Event={{
							Activated: () => {
								eventService.setRsvp(
									activeEvent.id,
									isInterested ? RsvpStatus.None : RsvpStatus.Interested,
								);
							},
							MouseButton1Click: () => {
								eventService.setRsvp(
									activeEvent.id,
									isInterested ? RsvpStatus.None : RsvpStatus.Interested,
								);
							},
						}}
					>
						<uicorner CornerRadius={new UDim(0, 12)} />
						<uistroke
							Color={isInterested ? Color3.fromHex("#ffffff") : Color3.fromHex("#282828")}
							Thickness={1}
						/>
						<textlabel
							key="Label"
							Size={new UDim2(1, 0, 1, 0)}
							BackgroundTransparency={1}
							Text="Interested"
							TextColor3={isInterested ? Color3.fromHex("#000000") : Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={13}
							ZIndex={11}
						/>
					</textbutton>
				</frame>
			</frame>
		);
	}

	// ─── 2. Primary Event List View (Referens: Screenshot 1) ─────────────────
	return (
		<frame key="EventApp" Size={new UDim2(1, 0, 1, 0)} BackgroundColor3={Color3.fromHex("#0c0c0c")} ZIndex={8}>
			{/* Header */}
			<frame key="Header" Size={new UDim2(1, 0, 0, 48)} BackgroundColor3={Color3.fromHex("#0c0c0c")} ZIndex={9}>
				<uistroke Color={Color3.fromHex("#1a1a1a")} Thickness={1} />
				<textbutton
					key="BackButton"
					AnchorPoint={new Vector2(0, 0.5)}
					Position={new UDim2(0, 12, 0.5, 0)}
					Size={new UDim2(0, 32, 0, 32)}
					BackgroundTransparency={1}
					Text=""
					AutoButtonColor={false}
					ZIndex={10}
					Event={{
						Activated: onBack,
						MouseButton1Click: onBack,
					}}
				>
					<LucideIcon
						name="chevron-left"
						size={new UDim2(0, 18, 0, 18)}
						anchorPoint={new Vector2(0.5, 0.5)}
						position={new UDim2(0.5, 0, 0.5, 0)}
						color={Color3.fromHex("#ffffff")}
						zIndex={10}
					/>
				</textbutton>

				<textlabel
					key="Title"
					Position={new UDim2(0, 48, 0, 0)}
					Size={new UDim2(1, -96, 1, 0)}
					BackgroundTransparency={1}
					Text="Upcoming Events"
					TextColor3={Color3.fromHex("#ffffff")}
					Font={Fonts.Bold}
					TextSize={14}
					ZIndex={10}
				/>
			</frame>

			{/* Event Cards Scroll */}
			<scrollingframe
				key="EventsScroll"
				Position={new UDim2(0, 0, 0, 48)}
				Size={new UDim2(1, 0, 1, -48)}
				BackgroundTransparency={1}
				ScrollBarThickness={2}
				ScrollBarImageColor3={Color3.fromHex("#2a2a2a")}
				CanvasSize={new UDim2(0, 0, 0, 0)}
				AutomaticCanvasSize={Enum.AutomaticSize.Y}
				ZIndex={9}
			>
				<uilistlayout Padding={new UDim(0, 10)} SortOrder={Enum.SortOrder.LayoutOrder} />
				<uipadding
					PaddingTop={new UDim(0, 12)}
					PaddingBottom={new UDim(0, 20)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>

				{events.map((event, idx) => {
					const hasValidPoster = isPosterValid(event.posterAssetId);

					return (
						<textbutton
							key={`event_${event.id}`}
							LayoutOrder={idx}
							Size={new UDim2(1, 0, 0, 114)}
							BackgroundColor3={Color3.fromHex("#141414")}
							AutoButtonColor={false}
							Text=""
							ZIndex={10}
							Event={{
								Activated: () => setActiveEvent(event),
								MouseButton1Click: () => setActiveEvent(event),
							}}
						>
							<uicorner CornerRadius={new UDim(0, 14)} />
							<uistroke Color={Color3.fromHex("#1e1e1e")} Thickness={1} />
							<uipadding
								PaddingTop={new UDim(0, 12)}
								PaddingBottom={new UDim(0, 12)}
								PaddingLeft={new UDim(0, 12)}
								PaddingRight={new UDim(0, 12)}
							/>

							{/* Left: Poster thumbnail or placeholder */}
							<frame
								key="PosterContainer"
								Size={new UDim2(0, 78, 1, 0)}
								BackgroundColor3={Color3.fromHex("#191919")}
								ZIndex={11}
							>
								<uicorner CornerRadius={new UDim(0, 10)} />
								{hasValidPoster ? (
									<imagelabel
										key="PosterImg"
										Size={new UDim2(1, 0, 1, 0)}
										BackgroundTransparency={1}
										Image={event.posterAssetId}
										ScaleType={Enum.ScaleType.Crop}
										ZIndex={12}
									>
										<uicorner CornerRadius={new UDim(0, 10)} />
									</imagelabel>
								) : (
									<LucideIcon
										name="ticket"
										size={new UDim2(0, 24, 0, 24)}
										anchorPoint={new Vector2(0.5, 0.5)}
										position={new UDim2(0.5, 0, 0.5, 0)}
										color={Color3.fromHex("#4a4a4a")}
										zIndex={12}
									/>
								)}
							</frame>

							{/* Right: Event Info Column */}
							<frame
								key="InfoCol"
								Position={new UDim2(0, 90, 0, 0)}
								Size={new UDim2(1, -90, 1, 0)}
								BackgroundTransparency={1}
								ZIndex={11}
							>
								<uilistlayout
									FillDirection={Enum.FillDirection.Vertical}
									Padding={new UDim(0, 3)}
									SortOrder={Enum.SortOrder.LayoutOrder}
								/>

								{/* Category tag */}
								<textlabel
									key="Category"
									LayoutOrder={1}
									Size={new UDim2(1, 0, 0, 12)}
									BackgroundTransparency={1}
									Text={event.category.upper()}
									TextColor3={Color3.fromHex("#707070")}
									Font={Fonts.Bold}
									TextSize={9}
									TextXAlignment={Enum.TextXAlignment.Left}
									ZIndex={12}
								/>

								{/* Event Title */}
								<textlabel
									key="Title"
									LayoutOrder={2}
									Size={new UDim2(1, 0, 0, 18)}
									BackgroundTransparency={1}
									Text={event.title}
									TextColor3={Color3.fromHex("#ffffff")}
									Font={Fonts.Bold}
									TextSize={13}
									TextTruncate={Enum.TextTruncate.AtEnd}
									TextXAlignment={Enum.TextXAlignment.Left}
									ZIndex={12}
								/>

								{/* Divider gap */}
								<frame
									key="Gap"
									LayoutOrder={3}
									Size={new UDim2(1, 0, 0, 2)}
									BackgroundTransparency={1}
								/>

								{/* Date Row */}
								<frame
									key="DateRow"
									LayoutOrder={4}
									Size={new UDim2(1, 0, 0, 14)}
									BackgroundTransparency={1}
									ZIndex={12}
								>
									<uilistlayout
										FillDirection={Enum.FillDirection.Horizontal}
										VerticalAlignment={Enum.VerticalAlignment.Center}
										Padding={new UDim(0, 6)}
										SortOrder={Enum.SortOrder.LayoutOrder}
									/>
									<LucideIcon
										name="calendar"
										size={new UDim2(0, 11, 0, 11)}
										color={Color3.fromHex("#666666")}
										zIndex={13}
										layoutOrder={1}
									/>
									<textlabel
										key="DateText"
										LayoutOrder={2}
										BackgroundTransparency={1}
										AutomaticSize={Enum.AutomaticSize.XY}
										Text={event.dateText}
										TextColor3={Color3.fromHex("#888888")}
										Font={Fonts.Regular}
										TextSize={10}
										ZIndex={13}
									/>
								</frame>

								{/* Location Row */}
								<frame
									key="LocRow"
									LayoutOrder={5}
									Size={new UDim2(1, 0, 0, 14)}
									BackgroundTransparency={1}
									ZIndex={12}
								>
									<uilistlayout
										FillDirection={Enum.FillDirection.Horizontal}
										VerticalAlignment={Enum.VerticalAlignment.Center}
										Padding={new UDim(0, 6)}
										SortOrder={Enum.SortOrder.LayoutOrder}
									/>
									<LucideIcon
										name="map-pin"
										size={new UDim2(0, 11, 0, 11)}
										color={Color3.fromHex("#666666")}
										zIndex={13}
										layoutOrder={1}
									/>
									<textlabel
										key="LocText"
										LayoutOrder={2}
										BackgroundTransparency={1}
										AutomaticSize={Enum.AutomaticSize.XY}
										Text={event.locationText}
										TextColor3={Color3.fromHex("#888888")}
										Font={Fonts.Regular}
										TextSize={10}
										ZIndex={13}
									/>
								</frame>

								{/* Going Count Row */}
								<frame
									key="GoingRow"
									LayoutOrder={6}
									Size={new UDim2(1, 0, 0, 14)}
									BackgroundTransparency={1}
									ZIndex={12}
								>
									<uilistlayout
										FillDirection={Enum.FillDirection.Horizontal}
										VerticalAlignment={Enum.VerticalAlignment.Center}
										Padding={new UDim(0, 6)}
										SortOrder={Enum.SortOrder.LayoutOrder}
									/>
									<LucideIcon
										name="users"
										size={new UDim2(0, 11, 0, 11)}
										color={Color3.fromHex("#666666")}
										zIndex={13}
										layoutOrder={1}
									/>
									<textlabel
										key="GoingText"
										LayoutOrder={2}
										BackgroundTransparency={1}
										AutomaticSize={Enum.AutomaticSize.XY}
										Text={`${event.goingUserIds.size()} Going`}
										TextColor3={Color3.fromHex("#888888")}
										Font={Fonts.Regular}
										TextSize={10}
										ZIndex={13}
									/>
								</frame>
							</frame>
						</textbutton>
					);
				})}
			</scrollingframe>
		</frame>
	);
}

/**
 * iOS-styled Event App.
 * Migrated to React TSX declarative renderer.
 */
export class EventApp {
	private hostInstance: GuiObject;
	private root: Root;
	private visible = false;
	private onBackCallbacks: Array<() => void> = [];

	constructor(parent: GuiObject) {
		this.hostInstance = parent;
		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	private render(): void {
		this.root.render(
			<EventComponent
				visible={this.visible}
				onBack={() => {
					for (const cb of this.onBackCallbacks) cb();
				}}
			/>,
		);
	}

	public onBack(cb: () => void): void {
		this.onBackCallbacks.push(cb);
	}

	public show(): void {
		this.visible = true;
		this.render();
		EventService.getInstance().fetchEvents();
	}

	public hide(): void {
		this.visible = false;
		this.render();
	}

	public destroy(): void {
		this.root.unmount();
	}
}
