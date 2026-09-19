/**
 * Interface that all Tool-bound OOP client components must implement.
 * Ensures consistent lifecycle management within ToolController.
 */
export interface IToolComponent {
	readonly tool: Tool;
	destroy(): void;
}
