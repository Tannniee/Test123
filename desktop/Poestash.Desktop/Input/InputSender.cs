using System.Runtime.InteropServices;

namespace Poestash.Desktop.Input;

public static class InputSender
{
    private const int INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const ushort VK_CONTROL = 0x11;
    private const ushort VK_C = 0x43;

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)]
        public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT
    {
        public int type;
        public InputUnion u;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, [MarshalAs(UnmanagedType.LPArray)] INPUT[] pInputs, int cbSize);

    /// <summary>
    /// Simulates a single Ctrl+C key combination using Win32 SendInput.
    /// Safe, minimal, non-blocking.
    /// </summary>
    public static bool SendCtrlC()
    {
        var inputs = new INPUT[4];

        // 1. Ctrl Down
        inputs[0] = new INPUT
        {
            type = INPUT_KEYBOARD,
            u = new InputUnion
            {
                ki = new KEYBDINPUT { wVk = VK_CONTROL, dwFlags = 0 }
            }
        };

        // 2. C Down
        inputs[1] = new INPUT
        {
            type = INPUT_KEYBOARD,
            u = new InputUnion
            {
                ki = new KEYBDINPUT { wVk = VK_C, dwFlags = 0 }
            }
        };

        // 3. C Up
        inputs[2] = new INPUT
        {
            type = INPUT_KEYBOARD,
            u = new InputUnion
            {
                ki = new KEYBDINPUT { wVk = VK_C, dwFlags = KEYEVENTF_KEYUP }
            }
        };

        // 4. Ctrl Up
        inputs[3] = new INPUT
        {
            type = INPUT_KEYBOARD,
            u = new InputUnion
            {
                ki = new KEYBDINPUT { wVk = VK_CONTROL, dwFlags = KEYEVENTF_KEYUP }
            }
        };

        var sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>());
        return sent == inputs.Length;
    }
}
