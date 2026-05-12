import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

const apiBaseUrl = String.fromEnvironment(
  'AMEO_API_BASE_URL',
  defaultValue: 'http://127.0.0.1:8000',
);

void main() {
  runApp(const AmeoMobileApp());
}

class AmeoMobileApp extends StatelessWidget {
  const AmeoMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xff176b5b);
    return MaterialApp(
      title: 'Ameo',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: seed),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: seed,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const MobileHome(),
    );
  }
}

class AmeoApiClient {
  AmeoApiClient({this.baseUrl = apiBaseUrl});

  final String baseUrl;
  String? token;

  Future<Map<String, dynamic>> register({
    required String email,
    required String name,
    required String password,
    required String workspaceName,
  }) async {
    final payload = await _request(
      'POST',
      '/auth/register',
      body: {
        'email': email,
        'name': name,
        'password': password,
        'workspace_name': workspaceName,
      },
    );
    token = payload['access_token'] as String;
    return payload;
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final payload = await _request(
      'POST',
      '/auth/login',
      body: {'email': email, 'password': password},
    );
    token = payload['access_token'] as String;
    return payload;
  }

  Future<List<dynamic>> workspaces() async {
    return await _request('GET', '/workspaces') as List<dynamic>;
  }

  Future<List<dynamic>> tasks(int workspaceId) async {
    return await _request('GET', '/tasks?workspace_id=$workspaceId')
        as List<dynamic>;
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final request = await HttpClient().openUrl(method, uri);
    request.headers.contentType = ContentType.json;
    if (token != null) {
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
    }
    if (body != null) {
      request.write(jsonEncode(body));
    }

    final response = await request.close();
    final text = await response.transform(utf8.decoder).join();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_errorMessage(text, response.statusCode));
    }
    if (text.isEmpty) {
      return <String, dynamic>{};
    }
    final decoded = jsonDecode(text);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }
    return {'items': decoded};
  }

  String _errorMessage(String text, int statusCode) {
    try {
      final decoded = jsonDecode(text) as Map<String, dynamic>;
      return decoded['detail']?.toString() ?? 'Request failed: $statusCode';
    } catch (_) {
      return text.isNotEmpty ? text : 'Request failed: $statusCode';
    }
  }
}

class MobileHome extends StatefulWidget {
  const MobileHome({super.key});

  @override
  State<MobileHome> createState() => _MobileHomeState();
}

class _MobileHomeState extends State<MobileHome> {
  final AmeoApiClient api = AmeoApiClient();
  final emailController = TextEditingController(text: 'owner@example.com');
  final passwordController = TextEditingController(text: 'password123');
  final nameController = TextEditingController(text: 'Owner');
  final workspaceController = TextEditingController(text: 'Ameo Mobile');

  bool loading = false;
  String message = '';
  String userName = '';
  List<dynamic> workspaceItems = <dynamic>[];
  List<dynamic> taskItems = <dynamic>[];

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    nameController.dispose();
    workspaceController.dispose();
    super.dispose();
  }

  Future<void> authenticate({required bool register}) async {
    setState(() {
      loading = true;
      message = '';
    });
    try {
      final auth = register
          ? await api.register(
              email: emailController.text,
              name: nameController.text,
              password: passwordController.text,
              workspaceName: workspaceController.text,
            )
          : await api.login(
              email: emailController.text,
              password: passwordController.text,
            );
      final user = auth['user'] as Map<String, dynamic>;
      final workspaces = await api.workspaces();
      final workspaceId = workspaces.isEmpty
          ? null
          : workspaces.first['id'] as int;
      final tasks = workspaceId == null
          ? <dynamic>[]
          : await api.tasks(workspaceId);
      setState(() {
        userName = user['name'] as String;
        workspaceItems = workspaces;
        taskItems = tasks;
        message = register ? 'Workspace created.' : 'Signed in.';
      });
    } catch (error) {
      setState(() {
        message = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      setState(() {
        loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final workspaceName = workspaceItems.isEmpty
        ? 'No workspace'
        : workspaceItems.first['name'] as String;
    return Scaffold(
      appBar: AppBar(title: const Text('Ameo')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Mobile workspace',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 12),
            _AuthPanel(
              emailController: emailController,
              passwordController: passwordController,
              nameController: nameController,
              workspaceController: workspaceController,
              loading: loading,
              onLogin: () => authenticate(register: false),
              onRegister: () => authenticate(register: true),
            ),
            if (message.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(message),
            ],
            const SizedBox(height: 20),
            _SummaryPanel(
              userName: userName,
              workspaceName: workspaceName,
              taskCount: taskItems.length,
            ),
            const SizedBox(height: 20),
            Text('Tasks', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            if (taskItems.isEmpty)
              const Text('No tasks loaded.')
            else
              ...taskItems.map(
                (task) => _TaskTile(task: task as Map<String, dynamic>),
              ),
          ],
        ),
      ),
    );
  }
}

class _AuthPanel extends StatelessWidget {
  const _AuthPanel({
    required this.emailController,
    required this.passwordController,
    required this.nameController,
    required this.workspaceController,
    required this.loading,
    required this.onLogin,
    required this.onRegister,
  });

  final TextEditingController emailController;
  final TextEditingController passwordController;
  final TextEditingController nameController;
  final TextEditingController workspaceController;
  final bool loading;
  final VoidCallback onLogin;
  final VoidCallback onRegister;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            TextField(
              controller: emailController,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            TextField(
              controller: passwordController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password'),
            ),
            TextField(
              controller: workspaceController,
              decoration: const InputDecoration(labelText: 'Workspace'),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: loading ? null : onLogin,
                    child: const Text('Login'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: loading ? null : onRegister,
                    child: const Text('Register'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryPanel extends StatelessWidget {
  const _SummaryPanel({
    required this.userName,
    required this.workspaceName,
    required this.taskCount,
  });

  final String userName;
  final String workspaceName;
  final int taskCount;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              userName.isEmpty ? 'Signed out' : userName,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(workspaceName),
            const SizedBox(height: 4),
            Text('$taskCount tasks'),
          ],
        ),
      ),
    );
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({required this.task});

  final Map<String, dynamic> task;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(task['title'] as String),
        subtitle: Text('${task['status']} - ${task['priority']}'),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}
