/**
 * NpcDialogueTypes.ts
 * Definisi tipe data untuk sistem percakapan NPC dan interaksi dialog.
 */

export interface DialogueOption {
	id: string;
	label: string;
	nextNodeId?: string;
	action?: "claim_skateboard" | "close" | string;
}

export interface DialogueNode {
	id: string;
	speakerName: string;
	message: string;
	options: DialogueOption[];
}

export interface NpcDialogueTree {
	npcId: string;
	speakerName: string;
	defaultNodeId: string;
	alreadyHasItemNodeId?: string;
	nodes: Record<string, DialogueNode>;
}

export interface NpcDialogueOpenPayload {
	npcId: string;
	dialogueTree: NpcDialogueTree;
	startNodeId: string;
}

export interface NpcDialogueActionPayload {
	npcId: string;
	action: string;
	nodeId?: string;
}
