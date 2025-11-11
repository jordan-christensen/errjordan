defmodule ErrjordanWeb.BentoSharedComponents do
  @moduledoc """
  Shared function components for the Bento surface.
  """

  use ErrjordanWeb, :html

  attr :label, :string, required: true
  attr :value, :string, required: true
  attr :change, :float, default: nil
  attr :trend, :list, default: []

  def stat_card(assigns) do
    ~H"""
    <div class="flex w-full min-w-[12rem] flex-col rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/60 p-4 shadow-sm shadow-gray-100/60 transition hover:-translate-y-0.5 hover:shadow-lg">
      <p class="text-sm font-medium text-gray-500">{@label}</p>
      <div class="mt-2 flex items-baseline gap-2">
        <p class="text-3xl font-semibold text-gray-900">{@value}</p>
        <%= unless is_nil(@change) do %>
          <span class={[
            "text-sm font-semibold",
            @change >= 0 && "text-emerald-600",
            @change < 0 && "text-rose-600"
          ]}>
            {format_change(@change)}
          </span>
        <% end %>
      </div>
      <%= if Enum.any?(@trend) do %>
        <div class="mt-4 h-12">
          <div class="relative h-full w-full overflow-hidden rounded-full bg-emerald-50/60">
            <div
              class="absolute bottom-0 left-0 h-full bg-gradient-to-r from-emerald-300/90 via-sky-300/90 to-indigo-300/80"
              style={"width: #{trend_width(@trend)}%"}
            />
          </div>
        </div>
      <% end %>
    </div>
    """
  end

  attr :status, :atom, default: :ok
  attr :label, :string, required: true

  def status_pill(assigns) do
    ~H"""
    <span class={[
      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
      pill_classes(@status)
    ]}>
      <span class="size-2 rounded-full bg-current" />
      {@label}
    </span>
    """
  end

  attr :items, :list, required: true

  def simple_list(assigns) do
    ~H"""
    <ul class="divide-y divide-gray-200 rounded-2xl border border-gray-100 bg-white">
      <li
        :for={item <- @items}
        id={item.id}
        class="flex flex-col gap-1 px-4 py-3 transition hover:bg-gray-50"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold text-gray-900">{item.title}</p>
          <p class="text-xs text-gray-400">{item.timestamp}</p>
        </div>
        <p class="text-xs text-gray-500">{item.detail}</p>
        <p class="text-[11px] font-semibold text-gray-400">{item.author}</p>
      </li>
    </ul>
    """
  end

  attr :title, :string, required: true
  slot :inner_block, required: true

  def panel(assigns) do
    ~H"""
    <section class="rounded-3xl border border-gray-100 bg-white/90 p-5 shadow-sm shadow-gray-100/80">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900">{@title}</h3>
        <button
          type="button"
          class="text-xs font-semibold uppercase tracking-wide text-gray-400 transition hover:text-gray-700"
        >
          View all
        </button>
      </div>
      <div>
        {render_slot(@inner_block)}
      </div>
    </section>
    """
  end

  defp format_change(change) when change >= 0, do: "+#{Float.round(change, 1)}%"
  defp format_change(change), do: "#{Float.round(change, 1)}%"

  defp trend_width(trend) do
    max_value = Enum.max(trend, fn -> 100 end)
    min(100, max_value)
  end

  defp pill_classes(:alert), do: "text-rose-700 bg-rose-50"
  defp pill_classes(:watch), do: "text-amber-700 bg-amber-50"
  defp pill_classes(:ok), do: "text-emerald-700 bg-emerald-50"
  defp pill_classes(:success), do: pill_classes(:ok)
  defp pill_classes(:info), do: "text-indigo-700 bg-indigo-50"
  defp pill_classes(_), do: "text-slate-600 bg-slate-50"
end
