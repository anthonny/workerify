import { h } from "nano-jsx";
import type { Filter, Todo } from "../types";
import { ViewFooter } from "./ViewFooter";
import { ViewTodo } from "./ViewTodo";

export const ViewTodos = ({
	todos,
	filter,
}: {
	todos: Todo[];
	filter: Filter;
}) => {
	return (
		<div
			className="flex flex-1 flex-col overflow-hidden"
			id="todos"
			hx-get="/api/todos?filter=<%= locals.filter %>"
			hx-trigger="sw-ready, todos:refresh from:body"
			hx-swap="outerHTML"
		>
			<div class="flex-1 overflow-y-auto overflow-x-hidden">
				{todos.map((todo) => (
					<ViewTodo todo={todo} filter={filter} />
				))}
			</div>
			<div id="footer">
				<ViewFooter todos={todos} filter={filter} />
			</div>
		</div>
	);
};
