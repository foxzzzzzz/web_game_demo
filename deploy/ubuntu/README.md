# Ubuntu 一键部署

该脚本面向本项目的单台 Ubuntu 云服务器：在已上传的项目代码目录中安装构建依赖、执行生产构建，并由 Nginx 直接托管 Vite 生成的静态文件。脚本不会下载、切换或更新 Git 代码。

## 首次部署

先将**完整项目代码**上传到服务器（必须包含 `package.json` 与 `pnpm-lock.yaml`）。部署脚本已在项目中，进入项目根目录后执行：

```bash
sudo bash deploy/ubuntu/deploy.sh
```

按提示输入域名（可留空）、部署目录、应用名和端口，并确认是否安装和配置 Nginx（默认 `true`）。选择 HTTPS 时还会要求输入用于证书续期通知的邮箱。脚本会把配置保存为 `/etc/<应用名>.env`，权限为 `600`。

域名留空时，部署完成后直接访问 `http://服务器公网IP`；端口不是 `80` 时需在 URL 后加端口。若输入域名，可以选择启用 HTTPS。启用前须确保该域名的 A/AAAA 记录已指向本服务器，并在云平台安全组中放行 TCP 80 和 443。

域名留空且使用 80 端口时，脚本会询问是否停用 Ubuntu 自带的 `default` Nginx 站点，以保证 IP 请求会命中游戏站点。仅在这台服务器不承载其他默认站点时选择 `true`；脚本不会删除任何自定义站点配置。

选择不配置 Nginx 时，脚本不会安装、改写或重载 Nginx，只会生成发布文件；此时不会自动提供 Web 访问入口。若要通过 IP 直接访问游戏，应选择配置 Nginx。

## 后续更新

```bash
sudo bash deploy/ubuntu/deploy.sh --config /etc/reborn-snake.env --non-interactive
```

先手动更新服务器上的项目代码，再运行此命令。脚本会在当前项目目录重新构建并发布；静态站点路径会切换到新的带时间戳版本目录。更新域名或端口时，编辑该配置文件后再执行上述命令。

## 验收与排查

不修改服务器的静态检查：

```bash
bash deploy/ubuntu/test-deploy-script.sh
```

仅检查已保存配置的格式，不安装软件也不改动 Nginx：

```bash
bash deploy/ubuntu/deploy.sh --config /etc/reborn-snake.env --validate-config
```

服务器部署后检查：

```bash
sudo nginx -t
curl -I http://127.0.0.1/
systemctl status nginx --no-pager
```

HTTPS 证书申请失败通常说明域名未解析到服务器，或云安全组/防火墙未开放 80 端口。脚本已完成 HTTP 部署；修正网络条件后以同一配置重新运行即可。
