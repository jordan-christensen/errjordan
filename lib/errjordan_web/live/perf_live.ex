defmodule ErrjordanWeb.PerfLive do
  use ErrjordanWeb, :live_view

  @default_opts %{concurrency: 8, rate_hz: 20, iterations: 2_000, payload_size: 256}

  def mount(_params, _session, socket) do
    form =
      @default_opts
      |> Map.new(fn {k, v} -> {to_string(k), v} end)
      |> Phoenix.Component.to_form(as: :perf)

    {:ok,
     socket
     |> assign(:running?, false)
     |> assign(:inflight, 0)
     |> assign(:opts, @default_opts)
     |> assign(:ops_total, 0)
     |> assign(:ops_per_sec, 0.0)
     |> assign(:last_ops_total, 0)
     |> assign(:work_timer, nil)
     |> assign(:stats_timer, nil)
     |> assign(:form, form)
     |> stream(:events, [])}
  end

  def render(assigns) do
    ~H"""
    <Layouts.app>
      <div class="space-y-6">
        <h1 class="text-2xl font-semibold">Performance Lab</h1>

        <.form for={@form} id="perf-form" phx-change="set" class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <label class="font-medium">Concurrency: {@opts.concurrency}</label>
            <.input field={@form[:concurrency]} type="range" min="1" max="64" step="1" />
          </div>
          <div class="space-y-2">
            <label class="font-medium">Rate (Hz): {@opts.rate_hz}</label>
            <.input field={@form[:rate_hz]} type="range" min="1" max="50" step="1" />
          </div>
          <div class="space-y-2">
            <label class="font-medium">Iterations (CPU work): {@opts.iterations}</label>
            <.input field={@form[:iterations]} type="range" min="500" max="10000" step="500" />
          </div>
          <div class="space-y-2">
            <label class="font-medium">Payload (bytes): {@opts.payload_size}</label>
            <.input field={@form[:payload_size]} type="range" min="64" max="4096" step="64" />
          </div>
        </.form>

        <div class="flex items-center gap-3">
          <button
            class="btn btn-primary"
            phx-click="start"
            disabled={@running?}
          >
            Start
          </button>
          <button
            class="btn"
            phx-click="stop"
            disabled={!@running?}
          >
            Stop
          </button>
          <div class="text-sm opacity-75">Inflight: {@inflight}</div>
        </div>

        <div id="latency" phx-hook=".Latency" class="grid grid-cols-3 gap-4 rounded border p-3">
          <div>
            <div class="text-xs opacity-70">RTT p50</div>
            <div id="rtt-p50" class="font-semibold">-</div>
          </div>
          <div>
            <div class="text-xs opacity-70">RTT p95</div>
            <div id="rtt-p95" class="font-semibold">-</div>
          </div>
          <div>
            <div class="text-xs opacity-70">RTT max</div>
            <div id="rtt-max" class="font-semibold">-</div>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div class="rounded border p-3">
            <div class="text-xs opacity-70">Ops/sec</div>
            <div class="font-semibold">{Float.round(@ops_per_sec, 1)}</div>
          </div>
          <div class="rounded border p-3">
            <div class="text-xs opacity-70">Total ops</div>
            <div class="font-semibold">{@ops_total}</div>
          </div>
          <div class="rounded border p-3">
            <div class="text-xs opacity-70">Process memory</div>
            <div class="font-semibold">{format_bytes(elem(Process.info(self(), :memory), 1))}</div>
          </div>
        </div>

        <div>
          <h2 class="mb-2 text-lg font-medium">Recent results</h2>
          <div id="events" phx-update="stream" class="space-y-1">
            <div :for={{id, ev} <- @streams.events} id={id} class="rounded border p-2 text-sm">
              <span class="opacity-70">#{ev.seq}</span>
              <span class="ml-2">{ev.ms} ms</span>
            </div>
          </div>
        </div>

        <script :type={Phoenix.LiveView.ColocatedHook} name=".Latency" phx-no-curly-interpolation>
          export default {
            mounted() {
              this.samples = []
              const schedule = () => setTimeout(() => this.pushEvent("ping", {sent_at: performance.now()}), 500)
              this.handleEvent("pong", ({sent_at}) => {
                const rtt = performance.now() - sent_at
                this.samples.push(rtt)
                if (this.samples.length > 200) this.samples.shift()
                const sorted = [...this.samples].sort((a,b)=>a-b)
                const p50 = sorted[Math.floor(sorted.length*0.5)]||0
                const p95 = sorted[Math.floor(sorted.length*0.95)]||0
                const max = Math.max(...this.samples, 0)
                this.el.querySelector('#rtt-p50').textContent = p50.toFixed(1) + ' ms'
                this.el.querySelector('#rtt-p95').textContent = p95.toFixed(1) + ' ms'
                this.el.querySelector('#rtt-max').textContent = max.toFixed(1) + ' ms'
                schedule()
              })
              // kick off
              this.pushEvent("ping", {sent_at: performance.now()})
            }
          }
        </script>
      </div>
    </Layouts.app>
    """
  end

  def handle_event("set", %{"perf" => params}, socket) do
    opts = normalize_opts(params)

    socket =
      socket
      |> assign(:opts, opts)
      |> assign(:form, Phoenix.Component.to_form(Map.new(params), as: :perf))
      |> maybe_reschedule_work_timer()

    {:noreply, socket}
  end

  def handle_event("start", _params, %{assigns: %{running?: true}} = socket),
    do: {:noreply, socket}

  def handle_event("start", _params, socket) do
    socket =
      socket
      |> assign(:running?, true)
      |> assign(:ops_total, 0)
      |> assign(:ops_per_sec, 0.0)
      |> assign(:last_ops_total, 0)
      |> schedule_work_timer()
      |> schedule_stats_timer()

    {:noreply, socket}
  end

  def handle_event("stop", _params, socket) do
    {:noreply, stop_all(socket)}
  end

  def handle_event("ping", %{"sent_at" => sent_at}, socket) do
    {:noreply, Phoenix.LiveView.push_event(socket, "pong", %{sent_at: sent_at})}
  end

  def handle_info(:tick_work, socket) do
    %{inflight: inflight, opts: %{concurrency: max}} = socket.assigns

    if inflight < max and socket.assigns.running? do
      spawn(fn ->
        {ms, _} =
          :timer.tc(fn ->
            work(socket.assigns.opts.iterations, socket.assigns.opts.payload_size)
          end)

        send(self(), {:work_done, System.monotonic_time(), div(ms, 1000)})
      end)

      {:noreply, assign(socket, :inflight, inflight + 1)}
    else
      {:noreply, socket}
    end
  end

  def handle_info({:work_done, _ts, ms}, socket) do
    seq = socket.assigns.ops_total + 1
    ev = %{seq: seq, ms: ms}

    socket =
      socket
      |> assign(:ops_total, seq)
      |> assign(:inflight, max(socket.assigns.inflight - 1, 0))
      |> stream(:events, [ev])

    {:noreply, socket}
  end

  def handle_info(:tick_stats, socket) do
    ops = socket.assigns.ops_total - socket.assigns.last_ops_total

    socket =
      socket
      |> assign(:ops_per_sec, ops * 1.0)
      |> assign(:last_ops_total, socket.assigns.ops_total)

    {:noreply, socket}
  end

  defp schedule_work_timer(%{assigns: %{opts: %{rate_hz: hz}}} = socket) do
    ms = max(div(1000, max(hz, 1)), 1)
    send(self(), :tick_work)
    # keep future ticks flowing at the requested rate
    {:ok, tref} = :timer.send_interval(ms, :tick_work)

    socket
    |> assign(:work_timer, tref)
  end

  defp schedule_stats_timer(socket) do
    {:ok, tref} = :timer.send_interval(1000, :tick_stats)
    assign(socket, :stats_timer, tref)
  end

  defp maybe_reschedule_work_timer(%{assigns: %{running?: true}} = socket) do
    # cancel and reschedule with new rate
    socket = cancel_timer(socket, :work_timer)
    schedule_work_timer(socket)
  end

  defp maybe_reschedule_work_timer(socket), do: socket

  defp stop_all(socket) do
    socket
    |> cancel_timer(:work_timer)
    |> cancel_timer(:stats_timer)
    |> assign(:running?, false)
    |> assign(:inflight, 0)
  end

  defp cancel_timer(socket, key) do
    case Map.get(socket.assigns, key) do
      nil ->
        socket

      tref ->
        :timer.cancel(tref)
        assign(socket, key, nil)
    end
  end

  defp normalize_opts(params) do
    %{
      concurrency: clamp(int(params["concurrency"]) || @default_opts.concurrency, 1, 64),
      rate_hz: clamp(int(params["rate_hz"]) || @default_opts.rate_hz, 1, 50),
      iterations: clamp(int(params["iterations"]) || @default_opts.iterations, 500, 10_000),
      payload_size: clamp(int(params["payload_size"]) || @default_opts.payload_size, 64, 4096)
    }
  end

  defp int(nil), do: nil
  defp int(""), do: nil
  defp int(val) when is_integer(val), do: val

  defp int(val) when is_binary(val) do
    case Integer.parse(val) do
      {i, _} -> i
      :error -> nil
    end
  end

  defp clamp(v, min, _max) when v < min, do: min
  defp clamp(v, _min, max) when v > max, do: max
  defp clamp(v, _min, _max), do: v

  defp work(iterations, payload_size) do
    data = :crypto.strong_rand_bytes(min(payload_size, 4096))
    Enum.reduce(1..iterations, data, fn _, acc -> :crypto.hash(:sha256, acc) end)
  end

  defp format_bytes(bytes) when is_integer(bytes) do
    cond do
      bytes < 1024 -> "#{bytes} B"
      bytes < 1024 * 1024 -> :io_lib.format("~.1f KB", [bytes / 1024]) |> IO.iodata_to_binary()
      true -> :io_lib.format("~.1f MB", [bytes / (1024 * 1024)]) |> IO.iodata_to_binary()
    end
  end
end
