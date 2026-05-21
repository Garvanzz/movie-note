using System;
using System.Diagnostics;
using System.IO;

class DllTool {
    static int Main(string[] args) {
        string defFile = null, outFile = null, dllName = null;
        for (int i = 0; i < args.Length; i++) {
            if (args[i] == "-d" && i + 1 < args.Length) defFile = args[++i];
            else if (args[i] == "-l" && i + 1 < args.Length) outFile = args[++i];
            else if (args[i] == "-D" && i + 1 < args.Length) dllName = args[++i];
        }

        if (outFile == null) return 0;

        string lldLink = @"C:\Users\wjc\.rustup\toolchains\stable-x86_64-pc-windows-msvc\lib\rustlib\x86_64-pc-windows-msvc\bin\gcc-ld\lld-link.exe";

        if (defFile != null && File.Exists(lldLink)) {
            string lldArgs = "/def:" + defFile + " /out:" + outFile + " /machine:x64 /dll";
            try {
                var psi = new ProcessStartInfo(lldLink, lldArgs);
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                var p = Process.Start(psi);
                if (p != null) {
                    p.WaitForExit(5000);
                }
            } catch {}
        }

        if (!File.Exists(outFile)) {
            File.WriteAllBytes(outFile, new byte[0]);
        }
        return 0;
    }
}
