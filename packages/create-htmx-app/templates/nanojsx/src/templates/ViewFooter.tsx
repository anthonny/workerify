import { h } from "nano-jsx";
import type { Filter, Todo } from "../types";

export const ViewFooter = ({
	todos,
	filter,
}: {
	todos: Todo[];
	filter: Filter;
}) => {
	const uncheckedCount = todos.filter((t) => t.status === "unchecked").length;
	const checkedCount = todos.filter((t) => t.status === "checked").length;

	return (
		<div class="flex justify-between items-center px-4 py-2 bg-gray-800 text-white">
			<div>
				<b>{uncheckedCount}</b> item{uncheckedCount !== 1 && "s"} left
			</div>

			<div>
				<ul className="flex text-gray-600 gap-2">
					<li
						type="button"
						class={`cursor-pointer ${filter === "all" ? "text-white" : ""}`}
						hx-get="/api/todos?filter=all"
						hx-trigger="click"
						hx-target="#todos"
						hx-push-url="/?filter=all"
					>
						All
					</li>
					<li
						type="button"
						class={`cursor-pointer ${filter === "unchecked" ? "text-white" : ""}`}
						hx-get="/api/todos?filter=unchecked"
						hx-trigger="click"
						hx-target="#todos"
						hx-push-url="/?filter=unchecked"
					>
						Active
					</li>
					<li
						type="button"
						class={`cursor-pointer ${filter === "checked" ? "text-white" : ""}`}
						hx-get="/api/todos?filter=checked"
						hx-trigger="click"
						hx-target="#todos"
						hx-push-url="/?filter=checked"
					>
						Completed
					</li>
				</ul>
			</div>
		</div>
	);
};
